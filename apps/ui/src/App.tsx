import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useIntl } from 'react-intl';
import { TaskView, BoardView, TaskStatus } from '@kanbax/domain';
import { supabase } from './supabaseClient';

type DropdownOption = {
    value: string;
    labelId: string;
    defaultMessage: string;
};

const INBOX_SOURCE_OPTIONS: DropdownOption[] = [
    { value: 'email', labelId: 'inbox.source.email', defaultMessage: 'Email' },
    { value: 'meeting', labelId: 'inbox.source.meeting', defaultMessage: 'Meeting note' },
    { value: 'request', labelId: 'inbox.source.request', defaultMessage: 'Request' },
    { value: 'idea', labelId: 'inbox.source.idea', defaultMessage: 'Idea' },
    { value: 'external', labelId: 'inbox.source.external', defaultMessage: 'External' }
];

const INBOX_ACTION_OPTIONS: DropdownOption[] = [
    { value: 'this-week', labelId: 'inbox.action.thisWeek', defaultMessage: 'This Week' },
    { value: 'next-week', labelId: 'inbox.action.nextWeek', defaultMessage: 'Next Week' },
    { value: 'later', labelId: 'inbox.action.later', defaultMessage: 'Later' },
    { value: 'archive', labelId: 'inbox.action.archive', defaultMessage: 'Archive' }
];
const INBOX_PRIORITY_OPTIONS: DropdownOption[] = [
    { value: 'LOW', labelId: 'priority.low', defaultMessage: 'Low' },
    { value: 'MEDIUM', labelId: 'priority.medium', defaultMessage: 'Medium' },
    { value: 'HIGH', labelId: 'priority.high', defaultMessage: 'High' },
    { value: 'CRITICAL', labelId: 'priority.critical', defaultMessage: 'Critical' }
];

const API_BASE = 'http://localhost:4000';
const ARCHIVED_BOARD_ID = 'archived';
const ALL_BOARD_ID = 'all';
const OWN_BOARD_ID = 'mine';

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

type InitiativeStatus = 'ACTIVE' | 'CLOSED';

interface Initiative {
    id: string;
    name: string;
    goal?: string | null;
    description?: string | null;
    ownerId?: string | null;
    status: InitiativeStatus;
    createdAt: string;
    closedAt?: string | null;
}

interface ScopeWindow {
    id: string;
    name: string;
    description?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    taskIds: string[];
    createdAt: string;
    visibility?: 'personal' | 'shared';
    createdBy?: string | null;
    completionStatus?: 'YES' | 'PARTIAL' | 'NO' | null;
    completionComment?: string | null;
    completedAt?: string | null;
    completedBy?: string | null;
    initiativeId?: string | null;
    role?: 'ADMIN' | 'MEMBER' | 'VIEWER';
    members?: Array<{ userId: string; role: 'ADMIN' | 'MEMBER' | 'VIEWER' }>;
}


const INBOX_STORAGE_KEY = 'kanbax-inbox-items';
const INBOX_STATUS_STORAGE_KEY = 'kanbax-inbox-statuses';
const INBOX_PLANNED_STORAGE_KEY = 'kanbax-inbox-planned-scopes';
const TIMELINE_OVERRIDE_KEY = 'kanbax-timeline-overrides';
const INITIATIVES_STORAGE_KEY = 'kanbax-initiatives';
type InboxStatus = 'eingang' | 'spaeter' | 'bearbeitet' | 'archiv';
type InboxView = InboxStatus;
type TimelineOverride = { date: string; isPoint: boolean; durationDays?: number };
const WEEKLY_SCOPE_PREFIX = 'weekly:';
const getWeekStart = (date: Date) => {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const day = start.getDay();
    const diff = (day + 6) % 7;
    start.setDate(start.getDate() - diff);
    return start;
};
const getWeekEnd = (date: Date) => {
    const start = getWeekStart(date);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return end;
};
const toISODate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};
const buildWeeklyScopeKey = (tenantId: string, weekStart: Date) => `${tenantId}:${toISODate(weekStart)}`;
const getWeekNumber = (date: Date) => {
    const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = target.getUTCDay() || 7;
    target.setUTCDate(target.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
    const diff = target.getTime() - yearStart.getTime();
    return Math.ceil(((diff / 86400000) + 1) / 7);
};
const loadInboxStatuses = (): Record<string, InboxStatus> => {
    if (typeof window === 'undefined') return {};
    try {
        const stored = window.localStorage.getItem(INBOX_STATUS_STORAGE_KEY);
        if (!stored) return {};
        return JSON.parse(stored) as Record<string, InboxStatus>;
    } catch {
        return {};
    }
};
const loadTimelineOverrides = (): Record<string, TimelineOverride> => {
    if (typeof window === 'undefined') return {};
    try {
        const stored = window.localStorage.getItem(TIMELINE_OVERRIDE_KEY);
        if (!stored) return {};
        return JSON.parse(stored) as Record<string, TimelineOverride>;
    } catch {
        return {};
    }
};
const loadInitiatives = (): Record<string, Initiative[]> => {
    if (typeof window === 'undefined') return {};
    try {
        const stored = window.localStorage.getItem(INITIATIVES_STORAGE_KEY);
        if (!stored) return {};
        return JSON.parse(stored) as Record<string, Initiative[]>;
    } catch {
        return {};
    }
};

const App: React.FC = () => {
    const intl = useIntl();
    const t = (id: string, defaultMessage: string) => intl.formatMessage({ id }, { defaultMessage });
    const getOptionLabel = (
        options: DropdownOption[],
        value: string | undefined,
        fallbackId: string,
        fallbackDefault: string
    ) => {
        if (!value) return t(fallbackId, fallbackDefault);
        const option = options.find((optionDef) => optionDef.value === value);
        return option ? t(option.labelId, option.defaultMessage) : value;
    };
    const getSourceLabel = (value?: string) =>
        getOptionLabel(INBOX_SOURCE_OPTIONS, value, 'inbox.field.selectSource', 'Quelle wählen');
    const getActionLabel = (value?: string) =>
        getOptionLabel(INBOX_ACTION_OPTIONS, value, 'inbox.field.selectAction', 'Aktion wählen');
    const getPriorityLabel = (value?: string) =>
        getOptionLabel(INBOX_PRIORITY_OPTIONS, value, 'task.field.selectPriority', 'Priority wählen');

    const [view, setView] = useState<'dashboard' | 'kanban' | 'list' | 'table' | 'timeline' | 'calendar' | 'settings' | 'okr' | 'scope' | 'inbox' | 'initiatives'>('dashboard');
    const [expandedTableTaskId, setExpandedTableTaskId] = useState<string | null>(null);
    const [detailTab, setDetailTab] = useState<'comments' | 'attachments' | 'activity'>('comments');
    const [inboxScopeMenuId, setInboxScopeMenuId] = useState<string | null>(null);
    const [inboxMovedId, setInboxMovedId] = useState<string | null>(null);
    const [inboxItemStatuses, setInboxItemStatuses] = useState<Record<string, InboxStatus>>(loadInboxStatuses);
    const [selectedInboxId, setSelectedInboxId] = useState<string | null>(null);
    const [inboxView, setInboxView] = useState<InboxView>('eingang');
    const inboxViewHeadings: Record<InboxView, { label: string; tooltip: string }> = {
        eingang: {
            label: t('inbox.view.incoming', 'Eingang'),
            tooltip: t('inbox.tooltip.incoming', 'Unsortierte Arbeit. Entscheide was wichtig ist')
        },
        spaeter: {
            label: t('inbox.view.later', 'Später'),
            tooltip: t('inbox.tooltip.review', 'Zur späteren Überprüfung')
        },
        bearbeitet: {
            label: t('inbox.view.review', 'Bearbeitet'),
            tooltip: t('inbox.tooltip.worked', 'Später / in Bearbeitung')
        },
        archiv: {
            label: t('inbox.view.archived', 'Archiviert'),
            tooltip: t('inbox.tooltip.archived', 'Archivierte Items')
        }
    };
    const [inboxCaptureOpen, setInboxCaptureOpen] = useState(false);
    const [inboxSourceOpen, setInboxSourceOpen] = useState(false);
    const [inboxActionOpen, setInboxActionOpen] = useState(false);
    const [inboxPriorityOpen, setInboxPriorityOpen] = useState(false);
    const inboxSourceRef = useRef<HTMLDivElement | null>(null);
    const inboxActionRef = useRef<HTMLDivElement | null>(null);
    const inboxScopeRef = useRef<HTMLDivElement | null>(null);
    const inboxPriorityRef = useRef<HTMLDivElement | null>(null);
    const saveIcon = (
        <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" stroke="currentColor">
            <path d="M5 6.5V20h14V8.5L17.5 5H6a1 1 0 0 0-1 1.5z" />
            <path d="M6 5.5h10v4H6z" />
            <circle cx="12" cy="15.5" r="2" fill="currentColor" stroke="none" />
        </svg>
    );
    const [inboxCustomItems, setInboxCustomItems] = useState<Array<{
        id: string;
        title: string;
        source?: string;
        createdAt: string;
        suggestedAction?: string;
        description?: string;
        priority?: TaskView['priority'];
        kind?: string;
        creatorLabel?: string;
        creatorAvatarUrl?: string;
        creatorId?: string;
        tenantId?: string | null;
        plannedScopeId?: string | null;
    }>>([]);
    const [inboxPlannedScopes, setInboxPlannedScopes] = useState<Record<string, string>>(() => {
        if (typeof window === 'undefined') return {};
        try {
            const raw = localStorage.getItem(INBOX_PLANNED_STORAGE_KEY);
            return raw ? (JSON.parse(raw) as Record<string, string>) : {};
        } catch {
            return {};
        }
    });
    const inboxSnapshotRef = useRef<{ items: typeof inboxCustomItems; statuses: Record<string, InboxStatus> }>({
        items: [],
        statuses: {},
    });
    const scopesFetchInFlightRef = useRef<Record<string, boolean>>({});
    const timelineFetchInFlightRef = useRef<Record<string, boolean>>({});
    const membersFetchInFlightRef = useRef<Record<string, boolean>>({});
    const inboxSyncRef = useRef<{ tenantId: string | null; skipNextSave: boolean }>({ tenantId: null, skipNextSave: false });
    type InboxItemsUpdater = typeof inboxCustomItems | ((items: typeof inboxCustomItems) => typeof inboxCustomItems);
    const persistInboxItems = (itemsOrUpdater: InboxItemsUpdater) => {
        const nextItems =
            typeof itemsOrUpdater === 'function'
                ? (itemsOrUpdater as (items: typeof inboxCustomItems) => typeof inboxCustomItems)(inboxCustomItems)
                : itemsOrUpdater;
        setInboxCustomItems(nextItems);
        try {
            localStorage.setItem(INBOX_STORAGE_KEY, JSON.stringify(nextItems));
        } catch {
            // ignore storage errors
        }
    };
    const persistInboxStatuses = (nextStatuses: Record<string, InboxStatus>) => {
        if (typeof window === 'undefined') return;
        try {
            window.localStorage.setItem(INBOX_STATUS_STORAGE_KEY, JSON.stringify(nextStatuses));
        } catch {
            // ignore storage errors
        }
    };
    const persistInboxPlannedScopes = (next: Record<string, string>) => {
        setInboxPlannedScopes(next);
        if (typeof window === 'undefined') return;
        try {
            window.localStorage.setItem(INBOX_PLANNED_STORAGE_KEY, JSON.stringify(next));
        } catch {
            // ignore storage errors
        }
    };
    useEffect(() => {
        inboxSnapshotRef.current = { items: inboxCustomItems, statuses: inboxItemStatuses };
    }, [inboxCustomItems, inboxItemStatuses]);
    const setInboxStatus = (id: string, status: InboxStatus) => {
        setInboxItemStatuses((prev) => {
            if (prev[id] === status) {
                return prev;
            }
            const next = { ...prev, [id]: status };
            persistInboxStatuses(next);
            return next;
        });
        if (status === 'bearbeitet') {
            setInboxMovedId(id);
        }
        if (status !== inboxView) {
            setSelectedInboxId(null);
        }
    };
    async function loadInboxForTenant(
        tenantId: string,
        localItems: typeof inboxCustomItems,
        localStatuses: Record<string, InboxStatus>
    ) {
        try {
            if (!session?.access_token) return;
            inboxSyncRef.current = { tenantId, skipNextSave: true };
            const res = await fetch(`${API_BASE}/teams/${tenantId}/inbox`, {
                headers: getApiHeaders(true, tenantId),
            });
            if (!res.ok) return;
            const data = await res.json();
            const items: typeof inboxCustomItems = Array.isArray(data?.items) ? (data.items as typeof inboxCustomItems) : [];
            const statuses = data?.statuses && typeof data.statuses === 'object' ? data.statuses : {};
            const filteredLocal = localItems.filter((item) => !item.tenantId || item.tenantId === tenantId);
            const localById = new Map(filteredLocal.map((item) => [item.id, item]));
            if (items.length === 0 && filteredLocal.length > 0) {
                await saveInboxForTenant(tenantId, filteredLocal, localStatuses);
                inboxSyncRef.current = { tenantId, skipNextSave: true };
                setInboxCustomItems(filteredLocal);
                setInboxItemStatuses(localStatuses);
                return;
            }
            const mergedItems = items.map((item) => {
                const local = localById.get(item.id);
                const plannedScopeId = item.plannedScopeId || local?.plannedScopeId || inboxPlannedScopes[item.id];
                return plannedScopeId ? { ...item, plannedScopeId } : item;
            });
            setInboxCustomItems(mergedItems);
            setInboxItemStatuses(statuses);
            try {
                localStorage.setItem(INBOX_STORAGE_KEY, JSON.stringify(mergedItems));
                localStorage.setItem(INBOX_STATUS_STORAGE_KEY, JSON.stringify(statuses));
            } catch {
                // ignore storage errors
            }
        } catch {
            // ignore
        }
    }

    async function saveInboxForTenant(
        tenantId: string,
        items: typeof inboxCustomItems,
        statuses: Record<string, InboxStatus>
    ) {
        try {
            if (!session?.access_token) return;
            const filteredItems = items.filter((item) => !item.tenantId || item.tenantId === tenantId);
            const filteredIds = new Set(filteredItems.map((item) => item.id));
            const filteredStatuses = Object.fromEntries(
                Object.entries(statuses).filter(([id]) => filteredIds.has(id))
            );
            await fetch(`${API_BASE}/teams/${tenantId}/inbox`, {
                method: 'PUT',
                headers: getApiHeaders(true, tenantId),
                body: JSON.stringify({
                    items: filteredItems.map((item) => ({
                        ...item,
                        creatorAvatarUrl: undefined,
                    })),
                    statuses: filteredStatuses,
                }),
            });
        } catch {
            // ignore
        }
    }
    const handleInboxAddToScope = async (
        item: { id: string; title: string; description?: string; kind?: string; creatorId?: string; priority?: TaskView['priority'] },
        scopeId: string
    ) => {
        if (!activeTenantId) return;
        try {
            const resolvedBoardId = resolveWritableBoardId(activeTenantId);
            const res = await fetch(`${API_BASE}/commands/task/create`, {
                method: 'POST',
                headers: getApiHeaders(true, activeTenantId),
                body: JSON.stringify({
                    title: item.title,
                    description: item.description || '',
                    kinds: item.kind ? [item.kind] : [],
                    status: TaskStatus.BACKLOG,
                    priority: item.priority || (settingsDraft?.defaultPriority as TaskView['priority']) || 'MEDIUM',
                    dueDate: undefined,
                    attachments: [],
                    ownerId: item.creatorId || userProfile?.id || undefined,
                    assignees: [],
                    boardId: resolvedBoardId,
                    source: { type: 'MANUAL', createdBy: item.creatorId || userProfile?.id || 'inbox' }
                })
            });

            if (!res.ok) {
                let message = 'Failed to create task';
                try {
                    const err = await res.json();
                    message = err?.error || message;
                } catch {
                    // ignore
                }
                throw new Error(message);
            }

            let createdTaskId: string | null = null;
            let createdTask: TaskView | null = null;
            try {
                const data = await res.json();
                createdTask = (data?.task || data) as TaskView;
                createdTaskId = createdTask?.id || data?.taskId || null;
            } catch {
                createdTaskId = null;
            }

            if (createdTaskId) {
                if (createdTask) {
                    setTasksByTenant((prev) => {
                        const current = prev[activeTenantId] || [];
                        if (current.some((task) => task.id === createdTaskId)) return prev;
                        return { ...prev, [activeTenantId]: [createdTask, ...current] };
                    });
                    setScopeTasksByTenant((prev) => {
                        const current = prev[activeTenantId] || [];
                        if (current.some((task) => task.id === createdTaskId)) return prev;
                        return { ...prev, [activeTenantId]: [createdTask, ...current] };
                    });
                    setTasks((prev) => {
                        if (prev.some((task) => task.id === createdTaskId)) return prev;
                        return [createdTask, ...prev];
                    });
                }
                handleScopeAddTask(scopeId, createdTaskId);
            } else {
                fetchData();
            }

            persistInboxItems((items) =>
                items.map((entry) =>
                    entry.id === item.id ? { ...entry, plannedScopeId: scopeId } : entry
                )
            );
            persistInboxPlannedScopes({ ...inboxPlannedScopes, [item.id]: scopeId });
            setInboxStatus(item.id, 'bearbeitet');
            setInboxScopeMenuId(null);
            setToastMessage(t('inbox.toast.addedToScope', 'Added to scope window'));
        } catch (e: any) {
            alert(e.message || 'Failed to add to scope');
        }
    };
    const handleInboxPlanThisWeek = (item: typeof inboxCustomItems[number]) => {
        const weeklyScope = ensureCurrentWeeklyScope();
        if (!weeklyScope) return;
        handleInboxAddToScope(item, weeklyScope.id);
    };
    const handleInboxEdit = (item: typeof inboxCustomItems[number]) => {
        setInboxDraft({
            title: item.title || '',
            source: item.source || '',
            suggestedAction: item.suggestedAction || '',
            description: item.description || '',
            priority: (item.priority as TaskView['priority']) || 'MEDIUM',
        });
        setInboxEditId(item.id);
        setInboxCaptureOpen(true);
    };
    const [inboxDraft, setInboxDraft] = useState({
        title: '',
        source: '',
        suggestedAction: '',
        description: '',
        priority: 'MEDIUM'
    });
    const [inboxEditId, setInboxEditId] = useState<string | null>(null);
    const handleClickOutside = (event: MouseEvent) => {
        if (inboxSourceOpen && inboxSourceRef.current && !inboxSourceRef.current.contains(event.target as Node)) {
            setInboxSourceOpen(false);
        }
        if (inboxActionOpen && inboxActionRef.current && !inboxActionRef.current.contains(event.target as Node)) {
            setInboxActionOpen(false);
        }
        if (inboxPriorityOpen && inboxPriorityRef.current && !inboxPriorityRef.current.contains(event.target as Node)) {
            setInboxPriorityOpen(false);
        }
        if (inboxScopeMenuId && inboxScopeRef.current && !inboxScopeRef.current.contains(event.target as Node)) {
            setInboxScopeMenuId(null);
        }
        if (scopeInitiativeOpen && scopeInitiativeRef.current && !scopeInitiativeRef.current.contains(event.target as Node)) {
            setScopeInitiativeOpen(false);
        }
    };

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
    useEffect(() => {
        const syncInitiativeFromUrl = () => {
            const params = new URLSearchParams(window.location.search);
            const initiativeParam = params.get('initiative');
            if (initiativeParam) {
                setInitiativeRouteId(initiativeParam);
                setView('initiatives');
                setInitiativeScreen('detail');
            } else {
                setInitiativeRouteId(null);
                setInitiativeScreen('list');
            }
        };
        syncInitiativeFromUrl();
        window.addEventListener('popstate', syncInitiativeFromUrl);
        return () => window.removeEventListener('popstate', syncInitiativeFromUrl);
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
    useEffect(() => {
        try {
            const raw = localStorage.getItem(INBOX_STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw) as typeof inboxCustomItems;
                const cleaned = parsed.map((item) => ({ ...item, creatorAvatarUrl: undefined }));
                persistInboxItems(cleaned);
            }
        } catch {
            // ignore
        }
    }, []);

    useEffect(() => {
        if (!activeTenantId || !session?.access_token) return;
        if (view !== 'inbox') return;
        loadInboxForTenant(activeTenantId, inboxCustomItems, inboxItemStatuses);
    }, [activeTenantId, session?.access_token, view]);
    useEffect(() => {
        if (!activeTenantId || !session?.access_token) return;
        if (view !== 'inbox') return;
        loadInboxForTenant(activeTenantId, inboxCustomItems, inboxItemStatuses);
        const interval = window.setInterval(() => {
            loadInboxForTenant(activeTenantId, inboxCustomItems, inboxItemStatuses);
        }, 10000);
        return () => window.clearInterval(interval);
    }, [activeTenantId, session?.access_token, view]);

    useEffect(() => {
        if (!selectedInboxId && inboxCustomItems.length > 0) {
            setSelectedInboxId(inboxCustomItems[0].id);
        }
    }, [inboxCustomItems, selectedInboxId]);
    useEffect(() => {
        if (!activeTenantId || !session?.access_token) return;
        if (inboxSyncRef.current.skipNextSave && inboxSyncRef.current.tenantId === activeTenantId) {
            inboxSyncRef.current = { tenantId: activeTenantId, skipNextSave: false };
            return;
        }
        saveInboxForTenant(activeTenantId, inboxCustomItems, inboxItemStatuses);
    }, [activeTenantId, inboxCustomItems, inboxItemStatuses, session?.access_token]);
    const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
    const [teamNameInput, setTeamNameInput] = useState('');
    const [huddleRenameInput, setHuddleRenameInput] = useState('');
    const [huddleRenameSaving, setHuddleRenameSaving] = useState(false);
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
    const [isQuickPinsOpen, setIsQuickPinsOpen] = useState(false);
    const [isFocusDropdownOpen, setIsFocusDropdownOpen] = useState(false);
    const focusDropdownRef = useRef<HTMLDivElement | null>(null);
    const quickPinsDropdownRef = useRef<HTMLDivElement | null>(null);
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
    const [scopeMenuOpen, setScopeMenuOpen] = useState(false);
    const [initiativeMenuOpen, setInitiativeMenuOpen] = useState(false);
    const [initiativesByTenant, setInitiativesByTenant] = useState<Record<string, Initiative[]>>(() => loadInitiatives());
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
                            existing.push({
                                ...window,
                                visibility: window.visibility === 'personal' ? 'personal' : 'shared',
                                createdBy: window.createdBy || null,
                                initiativeId: window.initiativeId ?? null,
                            });
                        }
                    });
                    migrated[tenantId] = existing;
                } else {
                    migrated[key] = value.map((window) => ({
                        ...window,
                        visibility: window.visibility === 'personal' ? 'personal' : 'shared',
                        createdBy: window.createdBy || null,
                        initiativeId: window.initiativeId ?? null,
                    }));
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
        visibility: 'shared' as 'shared' | 'personal',
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
    const [scopeDetailView, setScopeDetailView] = useState<'board' | 'list' | 'timeline'>('board');
    const [scopeTaskCreateTargetId, setScopeTaskCreateTargetId] = useState<string | null>(null);
    const [isScopeCreateOpen, setIsScopeCreateOpen] = useState(false);
    const [scopeTab, setScopeTab] = useState<'current' | 'review' | 'completed'>('current');
    const [isScopeSettingsOpen, setIsScopeSettingsOpen] = useState(false);
    const [initiativeScreen, setInitiativeScreen] = useState<'list' | 'detail'>('list');
    const [initiativeRouteId, setInitiativeRouteId] = useState<string | null>(null);
    const [activeInitiativeId, setActiveInitiativeId] = useState<string | null>(null);
    const [initiativeTab, setInitiativeTab] = useState<'ACTIVE' | 'CLOSED'>('ACTIVE');
    const [isInitiativeCreateOpen, setIsInitiativeCreateOpen] = useState(false);
    const [initiativeDraft, setInitiativeDraft] = useState({ name: '', goal: '', description: '', ownerId: '' });
    const [initiativeScopePickerId, setInitiativeScopePickerId] = useState('');
    const [initiativeScopeCreateForId, setInitiativeScopeCreateForId] = useState<string | null>(null);
    const [initiativeEditId, setInitiativeEditId] = useState<string | null>(null);
    const [scopeInitiativeOpen, setScopeInitiativeOpen] = useState(false);
    const scopeSyncRef = useRef<{ tenantId: string | null; skipNextSave: boolean }>({ tenantId: null, skipNextSave: false });
    const [showScopeDropRow, setShowScopeDropRow] = useState(false);
    const [scopeSettingsDraft, setScopeSettingsDraft] = useState({
        name: '',
        description: '',
        startDate: '',
        endDate: '',
        visibility: 'shared' as 'shared' | 'personal',
        members: [] as Array<{ userId: string; role: 'ADMIN' | 'MEMBER' | 'VIEWER' }>,
    });
    const [scopeMemberPickerId, setScopeMemberPickerId] = useState<string>('');
    const [scopeMemberPickerRole, setScopeMemberPickerRole] = useState<'ADMIN' | 'MEMBER' | 'VIEWER'>('MEMBER');
    const [scopeCompletionStatus, setScopeCompletionStatus] = useState<'' | 'YES' | 'PARTIAL' | 'NO'>('');
    const [scopeCompletionComment, setScopeCompletionComment] = useState('');
    const [scopeCompletionTargetId, setScopeCompletionTargetId] = useState('');
    const [isScopeCloseOpen, setIsScopeCloseOpen] = useState(false);
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
    const [quickFilter, setQuickFilter] = useState<'ALL' | 'MINE' | 'OVERDUE' | 'WEEK'>('ALL');
    const [labelFilterOpen, setLabelFilterOpen] = useState(false);
    const labelFilterRef = useRef<HTMLDivElement | null>(null);
    const [selectedLabelFilters, setSelectedLabelFilters] = useState<string[]>([]);
    const [priorityFilterOpen, setPriorityFilterOpen] = useState(false);
    const [statusFilterOpen, setStatusFilterOpen] = useState(false);
    const priorityFilterRef = useRef<HTMLDivElement | null>(null);
    const statusFilterRef = useRef<HTMLDivElement | null>(null);
    const scopePriorityFilterRef = useRef<HTMLDivElement | null>(null);
    const scopeStatusFilterRef = useRef<HTMLDivElement | null>(null);
    const scopeInitiativeRef = useRef<HTMLDivElement | null>(null);
    const [openMemberDropdownId, setOpenMemberDropdownId] = useState<string | null>(null);
    const [calendarDate, setCalendarDate] = useState(() => new Date());
    const [calendarSelectedDate, setCalendarSelectedDate] = useState(() => new Date());
    const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
    const [calendarImports, setCalendarImports] = useState<CalendarImport[]>([]);
    const [calendarLoading, setCalendarLoading] = useState(false);
    const [calendarError, setCalendarError] = useState<string | null>(null);
    const [timelineRange, setTimelineRange] = useState<'auto' | 14 | 30 | 60 | 90>('auto');
    const [timelineRangeOpen, setTimelineRangeOpen] = useState(false);
    const timelineRangeRef = useRef<HTMLDivElement | null>(null);
    const [timelineOverrides, setTimelineOverrides] = useState<Record<string, TimelineOverride>>(loadTimelineOverrides);
    const timelineOverridesRef = useRef<Record<string, TimelineOverride>>({});
    const timelineOverrideSyncRef = useRef<{ tenantId: string | null; skipNextSave: boolean }>({ tenantId: null, skipNextSave: false });
    const timelineScrollRef = useRef<HTMLDivElement | null>(null);
    const [timelineDragTaskId, setTimelineDragTaskId] = useState<string | null>(null);
    const [timelineDragOriginX, setTimelineDragOriginX] = useState(0);
    const [timelineDragOriginDate, setTimelineDragOriginDate] = useState<Date | null>(null);
    const [timelineDragOriginScroll, setTimelineDragOriginScroll] = useState(0);
    const [timelineDragOffsetDays, setTimelineDragOffsetDays] = useState(0);
    const [timelineDragIsPoint, setTimelineDragIsPoint] = useState(false);
    const [timelineDragDurationDays, setTimelineDragDurationDays] = useState(1);
    const [timelineDragMode, setTimelineDragMode] = useState<'move' | 'resize-start' | 'resize-end'>('move');
    const [timelineDragOriginStart, setTimelineDragOriginStart] = useState<Date | null>(null);
    const [timelineDragOriginDuration, setTimelineDragOriginDuration] = useState(1);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (isFocusDropdownOpen && focusDropdownRef.current && !focusDropdownRef.current.contains(target)) {
                setIsFocusDropdownOpen(false);
            }
            if (isQuickPinsOpen && quickPinsDropdownRef.current && !quickPinsDropdownRef.current.contains(target)) {
                setIsQuickPinsOpen(false);
            }
            if (labelFilterOpen && labelFilterRef.current && !labelFilterRef.current.contains(target)) {
                setLabelFilterOpen(false);
            }
            if (priorityFilterOpen && priorityFilterRef.current && !priorityFilterRef.current.contains(target)) {
                setPriorityFilterOpen(false);
            }
            if (statusFilterOpen && statusFilterRef.current && !statusFilterRef.current.contains(target)) {
                setStatusFilterOpen(false);
            }
            if (scopePriorityFilterOpen && scopePriorityFilterRef.current && !scopePriorityFilterRef.current.contains(target)) {
                setScopePriorityFilterOpen(false);
            }
            if (scopeStatusFilterOpen && scopeStatusFilterRef.current && !scopeStatusFilterRef.current.contains(target)) {
                setScopeStatusFilterOpen(false);
            }
            if (timelineRangeOpen && timelineRangeRef.current && !timelineRangeRef.current.contains(target)) {
                setTimelineRangeOpen(false);
            }
            if (openMemberDropdownId) {
                const container = (target as HTMLElement).closest('[data-member-dropdown]');
                if (!container) {
                    setOpenMemberDropdownId(null);
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [
        isFocusDropdownOpen,
        isQuickPinsOpen,
        labelFilterOpen,
        priorityFilterOpen,
        statusFilterOpen,
        scopePriorityFilterOpen,
        scopeStatusFilterOpen,
        timelineRangeOpen,
        openMemberDropdownId,
    ]);
    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            window.localStorage.setItem(TIMELINE_OVERRIDE_KEY, JSON.stringify(timelineOverrides));
        } catch {
            // ignore storage failures
        }
    }, [timelineOverrides]);
    useEffect(() => {
        timelineOverridesRef.current = timelineOverrides;
    }, [timelineOverrides]);

    async function loadTimelineOverridesForTenant(tenantId: string, localOverrides: Record<string, TimelineOverride>) {
        try {
            if (!session?.access_token) return;
            if (timelineFetchInFlightRef.current[tenantId]) return;
            timelineFetchInFlightRef.current[tenantId] = true;
            timelineOverrideSyncRef.current = { tenantId, skipNextSave: true };
            const res = await fetch(`${API_BASE}/teams/${tenantId}/timeline-overrides`, {
                headers: getApiHeaders(true, tenantId),
            });
            if (!res.ok) return;
            const data = await res.json();
            const overrides = data?.overrides && typeof data.overrides === 'object' ? data.overrides : {};
            if (Object.keys(overrides).length === 0 && Object.keys(localOverrides).length > 0) {
                await saveTimelineOverridesForTenant(tenantId, localOverrides);
                timelineOverrideSyncRef.current = { tenantId, skipNextSave: true };
                setTimelineOverrides(localOverrides);
                return;
            }
            setTimelineOverrides(overrides);
        } catch {
            // ignore
        } finally {
            timelineFetchInFlightRef.current[tenantId] = false;
        }
    }

    async function saveTimelineOverridesForTenant(tenantId: string, overrides: Record<string, TimelineOverride>) {
        try {
            if (!session?.access_token) return;
            await fetch(`${API_BASE}/teams/${tenantId}/timeline-overrides`, {
                method: 'PUT',
                headers: getApiHeaders(true, tenantId),
                body: JSON.stringify({ overrides }),
            });
        } catch {
            // ignore
        }
    }
    const [calendarImportFileName, setCalendarImportFileName] = useState('');
    const [calendarImportFile, setCalendarImportFile] = useState<File | null>(null);
    const [calendarImporting, setCalendarImporting] = useState(false);
    const [calendarImportInputKey, setCalendarImportInputKey] = useState(0);
    const [calendarImportUrlName, setCalendarImportUrlName] = useState('');
    const [calendarImportUrl, setCalendarImportUrl] = useState('');
    const [isBoardNavOpen, setIsBoardNavOpen] = useState(() => !isSidebarCollapsed);
    const [isOkrNavOpen, setIsOkrNavOpen] = useState(() => !isSidebarCollapsed && view === 'okr');
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        if (view !== 'kanban' && view !== 'table') {
            setIsBoardNavOpen(false);
        }
        if (view !== 'okr') {
            setIsOkrNavOpen(false);
        }
    }, [view]);

    const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'MEDIUM', dueDate: '' });
    const [newTaskAttachments, setNewTaskAttachments] = useState<TaskView['attachments']>([]);
    const [newTaskKinds, setNewTaskKinds] = useState<string[]>([]);
    const [newKindInput, setNewKindInput] = useState('');
    const [newTaskHuddleId, setNewTaskHuddleId] = useState<string | null>(null);
    const [newTaskBoardId, setNewTaskBoardId] = useState<string | null>(null);
    const [newTaskScopeId, setNewTaskScopeId] = useState<string | null>(null);
    const [newTaskOwnerId, setNewTaskOwnerId] = useState<string | null>(null);
    const [newTaskAssignees, setNewTaskAssignees] = useState<string[]>([]);
    const [newTaskStatus, setNewTaskStatus] = useState<TaskStatus>(TaskStatus.BACKLOG);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
    const [editTask, setEditTask] = useState({ title: '', description: '', priority: 'MEDIUM', dueDate: '' });
    const [editTaskHuddleId, setEditTaskHuddleId] = useState<string | null>(null);
    const [editTaskBoardId, setEditTaskBoardId] = useState<string | null>(null);
    const [editTaskBoardOriginal, setEditTaskBoardOriginal] = useState<string | null>(null);
    const [editTaskScopeId, setEditTaskScopeId] = useState<string | null>(null);
    const [editTaskScopeOriginal, setEditTaskScopeOriginal] = useState<string | null>(null);
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

    const fetchDataInFlightRef = useRef(false);
    const fetchDataPendingRef = useRef(false);
    const fetchData = async () => {
        if (fetchDataInFlightRef.current) return;
        fetchDataInFlightRef.current = true;
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
            if (!boardsRes.ok) throw new Error('Failed to fetch task lists');
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
            const nextBoardId = (storedBoardId && boardsData.some((b: BoardView) => b.id === storedBoardId))
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

            const tasksBoardId = nextBoardId || '';
            const tasksRes = await fetch(`${API_BASE}/tasks?boardId=${encodeURIComponent(tasksBoardId)}`, { headers: getApiHeaders() });
            if (!tasksRes.ok) throw new Error('Failed to fetch tasks');
            const tasksData = await tasksRes.json();

            const currentUserId = userProfile?.id || session?.user?.id || '';
            setTasks(tasksData);
            if (activeTenantId) {
                setTasksByTenant((prev) => {
                    const existing = prev[activeTenantId];
                    if (tasksBoardId !== 'all' && existing && existing.length > 0) {
                        return prev;
                    }
                    return { ...prev, [activeTenantId]: tasksData };
                });
            }
            const selectedBoard = nextBoardId
                ? boardsData.find((b: BoardView) => b.id === nextBoardId) || boardsData[0] || null
                : null;
            setBoard(selectedBoard);
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
            fetchDataInFlightRef.current = false;
            if (fetchDataPendingRef.current) {
                fetchDataPendingRef.current = false;
                fetchData();
            }
        }
    };
    const triggerFetchData = () => {
        if (fetchDataInFlightRef.current) {
            fetchDataPendingRef.current = true;
            return;
        }
        fetchData();
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
            const boardId = activeBoardId === ALL_BOARD_ID || activeBoardId === OWN_BOARD_ID || activeBoardId === ARCHIVED_BOARD_ID
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
                boardId: activeBoardId === ALL_BOARD_ID || activeBoardId === OWN_BOARD_ID || activeBoardId === ARCHIVED_BOARD_ID
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
        const name = prompt('Task list name');
        if (!name) return;
        try {
            const res = await fetch(`${API_BASE}/boards`, {
                method: 'POST',
                headers: getApiHeaders(),
                body: JSON.stringify({ name: name.trim() }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to create task list');
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
    const handleInitiativesNavClick = () => {
        setView('initiatives');
        setInitiativeScreen('list');
        setInitiativeRouteId(null);
        updateInitiativeUrl(null, 'replace');
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
            visibility: scopeDraft.visibility === 'personal' ? 'personal' : 'shared',
            createdBy: userProfile?.id || session?.user?.id || null,
            completionStatus: null,
            completionComment: null,
            completedAt: null,
            completedBy: null,
            initiativeId: initiativeScopeCreateForId || null,
            members: (userProfile?.id || session?.user?.id)
                ? [{ userId: userProfile?.id || session?.user?.id || '', role: 'ADMIN' }]
                : [],
        };
        updateScopeWindows((prev) => prev.concat(nextWindow));
        setScopeDraft({ name: '', description: '', startDate: '', endDate: '', visibility: 'shared' });
        setActiveScopeId(nextId);
        setIsScopeCreateOpen(false);
        setInitiativeScopeCreateForId(null);
    };

    const openScopeDetail = (scopeId: string) => {
        setView('scope');
        setActiveScopeId(scopeId);
        setScopeScreen('detail');
        setScopeRouteId(scopeId);
        updateScopeUrl(scopeId, 'push');
    };
    const openInitiativeDetail = (initiativeId: string) => {
        setActiveInitiativeId(initiativeId);
        setInitiativeScreen('detail');
        setInitiativeRouteId(initiativeId);
        updateInitiativeUrl(initiativeId, 'push');
    };
    const handleInitiativeCreate = () => {
        if (!activeTenantId) return;
        const trimmedName = initiativeDraft.name.trim();
        if (!trimmedName) return;
        const now = new Date().toISOString();
        const nextInitiative: Initiative = {
            id: createInitiativeId(),
            name: trimmedName,
            goal: initiativeDraft.goal.trim() || null,
            description: initiativeDraft.description.trim() || null,
            ownerId: initiativeDraft.ownerId || userProfile?.id || session?.user?.id || null,
            status: 'ACTIVE',
            createdAt: now,
            closedAt: null,
        };
        updateInitiatives(activeTenantId, (prev) => prev.concat(nextInitiative));
        setInitiativeDraft({ name: '', goal: '', description: '', ownerId: '' });
        setIsInitiativeCreateOpen(false);
        setInitiativeTab('ACTIVE');
        openInitiativeDetail(nextInitiative.id);
    };
    const handleInitiativeUpdate = () => {
        if (!activeTenantId || !initiativeEditId) return;
        const trimmedName = initiativeDraft.name.trim();
        if (!trimmedName) return;
        updateInitiatives(activeTenantId, (prev) =>
            prev.map((initiative) =>
                initiative.id === initiativeEditId
                    ? {
                        ...initiative,
                        name: trimmedName,
                        goal: initiativeDraft.goal.trim() || null,
                        description: initiativeDraft.description.trim() || null,
                        ownerId: initiativeDraft.ownerId || null,
                    }
                    : initiative
            )
        );
        setInitiativeEditId(null);
        setInitiativeDraft({ name: '', goal: '', description: '', ownerId: '' });
        setIsInitiativeCreateOpen(false);
    };
    const handleInitiativeClose = (initiativeId: string) => {
        if (!activeTenantId) return;
        updateInitiatives(activeTenantId, (prev) =>
            prev.map((initiative) =>
                initiative.id === initiativeId
                    ? { ...initiative, status: 'CLOSED', closedAt: new Date().toISOString() }
                    : initiative
            )
        );
        if (initiativeTab === 'ACTIVE') {
            setInitiativeTab('CLOSED');
        }
    };
    const handleInitiativeReopen = (initiativeId: string) => {
        if (!activeTenantId) return;
        updateInitiatives(activeTenantId, (prev) =>
            prev.map((initiative) =>
                initiative.id === initiativeId
                    ? { ...initiative, status: 'ACTIVE', closedAt: null }
                    : initiative
            )
        );
        if (initiativeTab === 'CLOSED') {
            setInitiativeTab('ACTIVE');
        }
    };
    const handleInitiativeDelete = (initiativeId: string) => {
        if (!activeTenantId) return;
        if (!confirm('Delete this initiative and unlink its scopes?')) return;
        updateInitiatives(activeTenantId, (prev) => prev.filter((initiative) => initiative.id !== initiativeId));
        updateScopeWindows((prev) =>
            prev.map((scope) =>
                scope.initiativeId === initiativeId ? { ...scope, initiativeId: null } : scope
            )
        );
        if (activeInitiativeId === initiativeId) {
            setActiveInitiativeId(null);
            setInitiativeScreen('list');
            setInitiativeRouteId(null);
            updateInitiativeUrl(null, 'replace');
        }
    };

    const handleScopeAddTask = (windowId: string, taskId: string) => {
        if (!canEditScopeById(windowId)) return;
        updateScopeWindows((prev) =>
            prev.map((window) =>
                window.id === windowId && !window.taskIds.includes(taskId)
                    ? { ...window, taskIds: window.taskIds.concat(taskId) }
                    : window
            )
        );
    };

    const setScopeInitiative = (scopeId: string, initiativeId: string | null) => {
        if (scopeId.startsWith(WEEKLY_SCOPE_PREFIX)) return;
        if (!canManageScopeById(scopeId)) return;
        updateScopeWindows((prev) =>
            prev.map((window) =>
                window.id === scopeId
                    ? { ...window, initiativeId: initiativeId || null }
                    : window
            )
        );
    };

    const handleScopeRemoveTask = (windowId: string, taskId: string) => {
        if (!canEditScopeById(windowId)) return;
        if (!confirm('Remove this task from the scope window?')) return;
        updateScopeWindows((prev) =>
            prev.map((window) =>
                window.id === windowId
                    ? { ...window, taskIds: window.taskIds.filter((id) => id !== taskId) }
                    : window
            )
        );
    };

    const handleScopeDelete = (windowId: string) => {
        if (!canManageScopeById(windowId)) return;
        if (!confirm('Delete this scope window and remove its task links?')) return;
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
        if (!canEditScopeById(windowId)) return;
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
        if (!canEditScopeById(windowId)) return;
        event.preventDefault();
        const taskId = event.dataTransfer.getData('text/plain') || draggingTaskId || '';
        if (!taskId) return;
        handleScopeAddTask(windowId, taskId);
        setScopeDropTargetId(null);
        setToastMessage('Added to scope window');
        finalizeDrag();
    };

    const scopeDragTargetRef = useRef<string | null>(null);
    const getScopeColumnStatus = (task: TaskView) =>
        task.status === TaskStatus.BACKLOG ? TaskStatus.TODO : task.status;

    const moveScopeTaskOrder = (
        windowId: string,
        taskId: string,
        targetId: string | null,
        targetStatus?: TaskStatus
    ) => {
        if (!canEditScopeById(windowId)) return;
        updateScopeWindows((prev) =>
            prev.map((window) => {
                if (window.id !== windowId) return window;
                const remaining = window.taskIds.filter((id) => id !== taskId);
                let insertIndex = remaining.length;
                if (targetId) {
                    const targetIndex = remaining.indexOf(targetId);
                    if (targetIndex >= 0) insertIndex = targetIndex;
                } else if (targetStatus) {
                    const lastIndex = remaining.reduce((acc, id, index) => {
                        const task = scopeTaskById.get(id);
                        if (!task) return acc;
                        const columnStatus = getScopeColumnStatus(task);
                        if (columnStatus === targetStatus) return index;
                        return acc;
                    }, -1);
                    insertIndex = lastIndex >= 0 ? lastIndex + 1 : remaining.length;
                }
                const nextIds = remaining.slice();
                nextIds.splice(insertIndex, 0, taskId);
                return { ...window, taskIds: nextIds };
            })
        );
    };

    const handleScopeCardDragOver = (event: React.DragEvent, status: TaskStatus, targetId: string) => {
        if (!canEditScopeById(activeScopeWindow?.id)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        if (!draggingTaskId || !activeScopeWindow) return;
        if (!activeScopeWindow.taskIds.includes(draggingTaskId)) return;
        const dragKey = `${status}:${targetId}`;
        if (scopeDragTargetRef.current === dragKey) return;
        scopeDragTargetRef.current = dragKey;
        event.currentTarget.classList.add('drag-over-card');
    };

    const handleScopeCardDragLeave = (event: React.DragEvent) => {
        const target = event.currentTarget as HTMLElement;
        const related = event.relatedTarget as HTMLElement | null;
        if (!related || !target.contains(related)) {
            event.currentTarget.classList.remove('drag-over-card');
        }
    };

    const handleScopeCardDrop = (event: React.DragEvent, status: TaskStatus, targetId: string) => {
        if (!canEditScopeById(activeScopeWindow?.id)) return;
        event.preventDefault();
        event.currentTarget.classList.remove('drag-over-card');
        const taskId = event.dataTransfer.getData('text/plain') || draggingTaskId || '';
        if (!taskId || !activeScopeWindow) return;
        if (!activeScopeWindow.taskIds.includes(taskId)) return;
        const sourceTask = scopeTaskById.get(taskId);
        const normalizedStatus = status === TaskStatus.TODO ? TaskStatus.TODO : status;
        const isSameColumn =
            sourceTask &&
            (sourceTask.status === normalizedStatus ||
                (normalizedStatus === TaskStatus.TODO && sourceTask.status === TaskStatus.BACKLOG));
        if (!isSameColumn) {
            handleUpdateStatus(taskId, normalizedStatus);
        }
        moveScopeTaskOrder(activeScopeWindow.id, taskId, targetId, normalizedStatus);
        scopeDragTargetRef.current = null;
        finalizeDrag();
    };

    const handleScopeColumnDragOver = (event: React.DragEvent) => {
        if (!canEditScopeById(activeScopeWindow?.id)) return;
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
        if (!canEditScopeById(activeScopeWindow?.id)) return;
        event.preventDefault();
        event.currentTarget.classList.remove('drag-over');
        const taskId = event.dataTransfer.getData('text/plain') || draggingTaskId || '';
        if (!taskId || !activeScopeWindow) return;
        if (!activeScopeWindow.taskIds.includes(taskId)) return;
        const sourceTask = scopeTaskById.get(taskId);
        const normalizedStatus = status === TaskStatus.TODO ? TaskStatus.TODO : status;
        const isSameColumn =
            sourceTask &&
            (sourceTask.status === normalizedStatus ||
                (normalizedStatus === TaskStatus.TODO && sourceTask.status === TaskStatus.BACKLOG));
        if (!isSameColumn) {
            handleUpdateStatus(taskId, normalizedStatus);
        }
        moveScopeTaskOrder(activeScopeWindow.id, taskId, null, normalizedStatus);
        setToastMessage(`Moved to ${normalizedStatus}`);
        finalizeDrag();
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
        if (activeBoardId === ARCHIVED_BOARD_ID || activeBoardId === ALL_BOARD_ID || activeBoardId === OWN_BOARD_ID) return;
        if (!confirm('Delete this task list and all its data? This cannot be undone.')) return;
        try {
            const res = await fetch(`${API_BASE}/boards/${activeBoardId}`, {
                method: 'DELETE',
                headers: getApiHeaders(),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to delete task list');
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
        items: Array<{ updatedAt?: string | Date; createdAt?: string | Date }>,
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
        const fromScope = scopeTasksByTenant[activeTenantId] || [];
        const fromTasks = tasksByTenant[activeTenantId] || [];
        if (fromScope.length === 0 && fromTasks.length === 0) return tasks || [];
        const merged = [...fromScope, ...fromTasks];
        const seen = new Set<string>();
        return merged.filter((task) => {
            if (!task?.id) return false;
            if (seen.has(task.id)) return false;
            seen.add(task.id);
            return true;
        });
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
        const parseDate = (value?: string | Date | null) => (value ? new Date(value) : null);
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
        const krSeries14 = buildSeriesForDays(keyResults as Array<{ updatedAt?: string | Date; createdAt?: string | Date }>, dayStart, 14);
        const activitySeries = activitySeries14.slice(7);
        const completionSeries = completionSeries14.slice(7);
        const openSeries = openSeries14.slice(7);
        const krSeries = krSeries14.slice(7);
        const toTimestamp = (value?: string | Date | null) => (value ? new Date(value).getTime() : 0);
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
            .sort((a, b) => toTimestamp(a.dueDate) - toTimestamp(b.dueDate))
            .slice(0, 5);
        const overdueTasks = validTasks
            .filter((task) => {
                const due = parseDate(task.dueDate);
                return due && due < now && isOpenTask(task);
            })
            .sort((a, b) => toTimestamp(a.dueDate) - toTimestamp(b.dueDate))
            .slice(0, 5);
        const recentTasks = [...validTasks]
            .sort((a, b) => toTimestamp(b.updatedAt) - toTimestamp(a.updatedAt))
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

    const dashboardActivity = useMemo(() => {
        const entries = dashboardTasks.flatMap((task) => {
            const activity = task.activityLog || [];
            return activity.map((entry) => ({
                id: entry.id,
                taskId: task.id,
                tenantId: task.tenantId,
                boardId: task.boardId,
                title: task.title,
                message: entry.message,
                actorId: entry.actorId,
                timestamp: new Date(entry.timestamp),
            }));
        });
        return entries
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .slice(0, 8);
    }, [dashboardTasks]);

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
        if (activeBoardId !== OWN_BOARD_ID || !activeTenantId) return;
        const userId = userProfile?.id || session?.user?.id || '';
        if (!userId) return;
        const sourceTasks = tasksByTenant[activeTenantId];
        if (!sourceTasks) return;
        setTasks(
            sourceTasks.filter((task) =>
                task.ownerId === userId || (task.assignees || []).includes(userId)
            )
        );
    }, [activeBoardId, activeTenantId, userProfile?.id, session?.user?.id, tasksByTenant]);

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
        try {
            localStorage.setItem(INITIATIVES_STORAGE_KEY, JSON.stringify(initiativesByTenant));
        } catch {
            // ignore
        }
    }, [initiativesByTenant]);

    useEffect(() => {
        if (view === 'okr') {
            loadOkrs();
        }
    }, [view, session, activeTenantId, activeBoardId]);

    useEffect(() => {
        if (!activeTenantId || !session?.access_token) return;
        if (view !== 'scope' && !activeScopeId) return;
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
    }, [view, activeScopeId, activeTenantId, session?.access_token]);


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
            const isCollapsed = document.querySelector('.dashboard')?.classList.contains('sidebar-collapsed');
            const isSidebarTarget = Boolean(target.closest('.sidebar'));
            if (isSidebarTarget && !isCollapsed) return;
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

    const profileLoadRef = useRef({ inFlight: false, lastAt: 0 });
    const loadProfile = async () => {
        if (!session?.access_token) return;
        if (profileLoadRef.current.inFlight) return;
        const now = Date.now();
        if (now - profileLoadRef.current.lastAt < 5000) return;
        profileLoadRef.current.inFlight = true;
        profileLoadRef.current.lastAt = now;
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
            profileLoadRef.current.inFlight = false;
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
            const activeMembership = memberships.find((membership) => membership.tenantId === activeTenantId);
            const currentName = activeMembership?.tenant?.name || '';
            setHuddleRenameInput(currentName);
        }
    }, [isTeamModalOpen, activeTenantId, memberships]);

    useEffect(() => {
        if (!activeTenantId || !session?.access_token) return;
        if (view !== 'scope' && view !== 'initiatives' && view !== 'settings') return;
        loadMembersForHuddle(activeTenantId);
        loadScopesForTenant(activeTenantId, resolveLocalScopeFallback(activeTenantId));
    }, [activeTenantId, memberships, session?.access_token, view]);
    useEffect(() => {
        if (!activeTenantId || !session?.access_token) return;
        if (view !== 'timeline' && !(view === 'scope' && scopeDetailView === 'timeline')) return;
        loadTimelineOverridesForTenant(activeTenantId, timelineOverrides);
    }, [activeTenantId, session?.access_token, view, scopeDetailView, timelineOverrides]);
    useEffect(() => {
        if (!activeTenantId || !session?.access_token) return;
        if (view !== 'timeline' && !(view === 'scope' && scopeDetailView === 'timeline')) return;
        if (timelineOverrideSyncRef.current.skipNextSave && timelineOverrideSyncRef.current.tenantId === activeTenantId) {
            timelineOverrideSyncRef.current = { tenantId: activeTenantId, skipNextSave: false };
            return;
        }
        saveTimelineOverridesForTenant(activeTenantId, timelineOverrides);
    }, [activeTenantId, timelineOverrides, session?.access_token, view, scopeDetailView]);
    const scopeBroadcastChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
    const tasksBroadcastChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
    const scopeTasksFetchInFlightRef = useRef<Record<string, boolean>>({});

    useEffect(() => {
        if (!activeTenantId || !session?.access_token) return;
        const inboxChannel = supabase
            .channel(`huddle-inbox-${activeTenantId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'huddle_inbox_items', filter: `tenant_id=eq.${activeTenantId}` },
                () => {
                    const snapshot = inboxSnapshotRef.current;
                    loadInboxForTenant(activeTenantId, snapshot.items, snapshot.statuses);
                }
            )
            .subscribe();
        const scopesChannel = supabase
            .channel(`huddle-scopes-${activeTenantId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'huddle_scopes', filter: `tenant_id=eq.${activeTenantId}` },
                () => {
                    loadScopesForTenant(activeTenantId, resolveLocalScopeFallback(activeTenantId));
                }
            )
            .subscribe();
        const scopeMembersChannel = supabase
            .channel(`huddle-scope-members-${activeTenantId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'huddle_scope_members', filter: `tenant_id=eq.${activeTenantId}` },
                () => {
                    loadScopesForTenant(activeTenantId, resolveLocalScopeFallback(activeTenantId));
                }
            )
            .subscribe();
        const timelineChannel = supabase
            .channel(`huddle-timeline-${activeTenantId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'huddle_timeline_overrides', filter: `tenant_id=eq.${activeTenantId}` },
                () => {
                    loadTimelineOverridesForTenant(activeTenantId, timelineOverridesRef.current);
                }
            )
            .subscribe();
        const scopeBroadcastChannel = supabase
            .channel(`huddle-scopes-broadcast-${activeTenantId}`, {
                config: { broadcast: { ack: true, self: false } },
            })
            .on('broadcast', { event: 'scope-update' }, () => {
                loadScopesForTenant(activeTenantId, resolveLocalScopeFallback(activeTenantId));
            })
            .subscribe();
        scopeBroadcastChannelRef.current = scopeBroadcastChannel;
        const tasksBroadcastChannel = supabase
            .channel(`huddle-tasks-broadcast-${activeTenantId}`, {
                config: { broadcast: { ack: true, self: false } },
            })
            .on('broadcast', { event: 'task-update' }, () => {
                triggerFetchData();
                refreshScopeTasksForTenant(activeTenantId);
            })
            .subscribe();
        tasksBroadcastChannelRef.current = tasksBroadcastChannel;
        const tasksChannel = supabase
            .channel(`huddle-tasks-${activeTenantId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'Task', filter: `tenantId=eq.${activeTenantId}` },
                () => {
                    triggerFetchData();
                }
            )
            .subscribe();
        const tasksLowerChannel = supabase
            .channel(`huddle-tasks-lower-${activeTenantId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'task', filter: `tenantId=eq.${activeTenantId}` },
                () => {
                    triggerFetchData();
                }
            )
            .subscribe();
        const favoritesChannel = supabase
            .channel(`huddle-task-favorites-${activeTenantId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'huddle_task_favorites', filter: `tenant_id=eq.${activeTenantId}` },
                () => {
                    triggerFetchData();
                }
            )
            .subscribe();
        return () => {
            supabase.removeChannel(inboxChannel);
            supabase.removeChannel(scopesChannel);
            supabase.removeChannel(scopeMembersChannel);
            supabase.removeChannel(timelineChannel);
            supabase.removeChannel(scopeBroadcastChannel);
            supabase.removeChannel(tasksChannel);
            supabase.removeChannel(tasksLowerChannel);
            supabase.removeChannel(favoritesChannel);
            supabase.removeChannel(tasksBroadcastChannel);
            scopeBroadcastChannelRef.current = null;
            tasksBroadcastChannelRef.current = null;
        };
    }, [activeTenantId, session?.access_token]);

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
    const taskById = new Map(tasks.map((task) => [task.id, task]));
    const currentUserLabel = String(userProfile?.email || session?.user?.email || 'U');
    const currentUserInitial = currentUserLabel.charAt(0).toUpperCase() || 'U';
    const currentUserAvatar = settingsDraft?.avatarUrl || userProfile?.avatarUrl || '';
    const toDateInput = (value?: string | null) => (value ? new Date(value).toISOString().slice(0, 10) : '');
    const isArchivedBoard = activeBoardId === ARCHIVED_BOARD_ID;
    const isAllBoard = activeBoardId === ALL_BOARD_ID;
    const isOwnBoard = activeBoardId === OWN_BOARD_ID;
    const isSpecialBoard = isAllBoard || isOwnBoard;
    const activeBoard = isArchivedBoard
        ? { id: ARCHIVED_BOARD_ID, name: 'Archived', columns: [] }
        : isAllBoard
            ? { id: ALL_BOARD_ID, name: 'All tasks', columns: [] }
            : isOwnBoard
                ? { id: OWN_BOARD_ID, name: 'My tickets', columns: [] }
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
    const updateInitiativeUrl = (initiativeId: string | null, mode: 'push' | 'replace' = 'push') => {
        const params = new URLSearchParams(window.location.search);
        if (initiativeId) {
            params.set('initiative', initiativeId);
        } else {
            params.delete('initiative');
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
                map.set(boardItem.id, boardItem.name || 'Tasks');
            }
        });
        map.set(ARCHIVED_BOARD_ID, 'Archived');
        if (!map.has('default-board')) {
            map.set('default-board', 'Main Tasks');
        }
        return map;
    }, [activeTenantId, boardsByTenant, boards]);
    const getBoardLabel = (boardId?: string | null) => {
        if (!boardId) return 'Tasks';
        return boardLabelById.get(boardId) || boardId;
    };
    const getStatusLabel = (status: TaskStatus | string) => {
        if (status === TaskStatus.TODO) return 'ToDo';
        if (status === TaskStatus.IN_PROGRESS) return 'Doing';
        if (status === TaskStatus.DONE) return 'Done';
        if (status === TaskStatus.BACKLOG) return 'ToDo';
        return String(status).replace(/_/g, ' ');
    };
    const scopeKey = activeTenantId || null;
    const scopeWindows = useMemo(() => {
        if (!scopeKey) return [];
        const raw = scopeWindowsByBoard[scopeKey] || [];
        const currentUserId = userProfile?.id || session?.user?.id || '';
        const isTeamAdminForScope = memberships.some(
            (membership) =>
                membership.tenantId === scopeKey
                && (membership.role === 'OWNER' || membership.role === 'ADMIN')
        );
        return raw.filter((window) => {
            if (window.visibility !== 'personal') return true;
            if (userProfile?.isSuperAdmin || isTeamAdminForScope) return true;
            if (!window.createdBy) return false;
            return window.createdBy === currentUserId;
        });
    }, [scopeKey, scopeWindowsByBoard, userProfile?.id, userProfile?.isSuperAdmin, session?.user?.id, memberships]);
    const getVisibleScopeWindowsForTenant = (tenantId?: string | null) => {
        if (!tenantId) return [];
        const raw = scopeWindowsByBoard[tenantId] || [];
        const currentUserId = userProfile?.id || session?.user?.id || '';
        const isTeamAdminForScope = memberships.some(
            (membership) =>
                membership.tenantId === tenantId
                && (membership.role === 'OWNER' || membership.role === 'ADMIN')
        );
        return raw.filter((window) => {
            if (window.visibility !== 'personal') return true;
            if (userProfile?.isSuperAdmin || isTeamAdminForScope) return true;
            if (!window.createdBy) return false;
            return window.createdBy === currentUserId;
        });
    };
    const currentWeeklyScopeId = (() => {
        if (!activeTenantId) return null;
        const weekStart = getWeekStart(new Date());
        return `${WEEKLY_SCOPE_PREFIX}${buildWeeklyScopeKey(activeTenantId, weekStart)}`;
    })();
    const currentWeeklyScope = useMemo(() => {
        if (!currentWeeklyScopeId) return null;
        return scopeWindows.find((window) => window.id === currentWeeklyScopeId) || null;
    }, [scopeWindows, currentWeeklyScopeId]);
    const weeklyScopeStats = useMemo(() => {
        if (!currentWeeklyScope) return null;
        const tasks = currentWeeklyScope.taskIds
            .map((taskId) => scopeTaskById.get(taskId))
            .filter(Boolean) as TaskView[];
        const done = tasks.filter((task) => task.status === TaskStatus.DONE).length;
        const open = tasks.filter((task) => isOpenTask(task)).length;
        const total = tasks.length;
        const completion = total ? Math.round((done / total) * 100) : 0;
        return { total, done, open, completion };
    }, [currentWeeklyScope, scopeTaskById]);
    const activeScopeWindow = useMemo(() => {
        if (!activeScopeId) return null;
        return scopeWindows.find((window) => window.id === activeScopeId) || null;
    }, [scopeWindows, activeScopeId]);
    const initiatives = useMemo(() => {
        if (!activeTenantId) return [];
        return initiativesByTenant[activeTenantId] || [];
    }, [activeTenantId, initiativesByTenant]);
    const initiativeLookup = useMemo(() => {
        return new Map(initiatives.map((initiative) => [initiative.id, initiative]));
    }, [initiatives]);
    const initiativeOptions = useMemo(() => {
        return [...initiatives].sort((a, b) => {
            if (a.status !== b.status) {
                return a.status === 'ACTIVE' ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
        });
    }, [initiatives]);
    const filteredInitiatives = useMemo(() => {
        return initiatives.filter((initiative) => initiative.status === initiativeTab);
    }, [initiatives, initiativeTab]);
    const activeInitiative = useMemo(() => {
        if (!activeInitiativeId) return null;
        return initiatives.find((initiative) => initiative.id === activeInitiativeId) || null;
    }, [initiatives, activeInitiativeId]);
    const initiativeMetricsById = useMemo(() => {
        const map = new Map<string, {
            totalScopes: number;
            activeScopes: number;
            closedScopes: number;
            totalTasks: number;
            doneTasks: number;
            openTasks: number;
            taskCompletion: number;
            scopeCompletion: number;
        }>();
        initiatives.forEach((initiative) => {
            const scopesForInitiative = scopeWindows.filter((scope) => scope.initiativeId === initiative.id);
            const totalScopes = scopesForInitiative.length;
            const closedScopes = scopesForInitiative.filter((scope) => Boolean(scope.completionStatus)).length;
            const activeScopes = Math.max(0, totalScopes - closedScopes);
            const taskIdSet = new Set<string>();
            scopesForInitiative.forEach((scope) => {
                scope.taskIds.forEach((taskId) => taskIdSet.add(taskId));
            });
            let totalTasks = 0;
            let doneTasks = 0;
            let openTasks = 0;
            taskIdSet.forEach((taskId) => {
                const task = scopeTaskById.get(taskId);
                if (!task) return;
                totalTasks += 1;
                if (task.status === TaskStatus.DONE) {
                    doneTasks += 1;
                } else if (task.status !== TaskStatus.ARCHIVED) {
                    openTasks += 1;
                }
            });
            const taskCompletion = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;
            const scopeCompletion = totalScopes ? Math.round((closedScopes / totalScopes) * 100) : 0;
            map.set(initiative.id, {
                totalScopes,
                activeScopes,
                closedScopes,
                totalTasks,
                doneTasks,
                openTasks,
                taskCompletion,
                scopeCompletion,
            });
        });
        return map;
    }, [initiatives, scopeWindows, scopeTaskById]);
    const activeInitiativeMetrics = useMemo(() => {
        if (!activeInitiativeId) return null;
        return initiativeMetricsById.get(activeInitiativeId) || null;
    }, [initiativeMetricsById, activeInitiativeId]);
    const initiativeScopes = useMemo(() => {
        if (!activeInitiativeId) return [];
        return scopeWindows.filter((scope) => scope.initiativeId === activeInitiativeId);
    }, [scopeWindows, activeInitiativeId]);
    const initiativeScopeOptions = useMemo(() => {
        if (!activeInitiativeId) return [];
        return scopeWindows.filter(
            (scope) =>
                scope.initiativeId !== activeInitiativeId
                && !scope.completionStatus
                && !scope.id.startsWith(WEEKLY_SCOPE_PREFIX)
        );
    }, [scopeWindows, activeInitiativeId]);
    const isTeamAdminForTenant = memberships.some(
        (membership) =>
            membership.tenantId === activeTenantId
            && (membership.role === 'OWNER' || membership.role === 'ADMIN')
    );
    const isSuperAdminForTenant = Boolean(userProfile?.isSuperAdmin);
    const resolveScopeRole = (scopeId: string | null | undefined) => {
        if (!scopeId) return (isTeamAdminForTenant || isSuperAdminForTenant) ? 'ADMIN' : 'VIEWER';
        const scope = scopeWindows.find((window) => window.id === scopeId);
        if (scope?.role) return scope.role;
        return (isTeamAdminForTenant || isSuperAdminForTenant) ? 'ADMIN' : 'VIEWER';
    };
    const canEditScopeById = (scopeId: string | null | undefined) => {
        if (scopeId) {
            const scope = scopeWindows.find((window) => window.id === scopeId);
            if (scope?.completionStatus) return false;
            if (scopeId.startsWith(WEEKLY_SCOPE_PREFIX)) return true;
        }
        const role = resolveScopeRole(scopeId);
        return isTeamAdminForTenant || isSuperAdminForTenant || role === 'ADMIN' || role === 'MEMBER';
    };
    const canManageScopeById = (scopeId: string | null | undefined) => {
        if (scopeId) {
            const scope = scopeWindows.find((window) => window.id === scopeId);
            if (scope?.completionStatus) return false;
        }
        const role = resolveScopeRole(scopeId);
        return isTeamAdminForTenant || isSuperAdminForTenant || role === 'ADMIN';
    };
    const activeScopeRole = resolveScopeRole(activeScopeWindow?.id);
    const canManageActiveScope = canManageScopeById(activeScopeWindow?.id);
    const canEditActiveScopeItems = canEditScopeById(activeScopeWindow?.id);
    const isActiveScopeCompleted = Boolean(activeScopeWindow?.completionStatus);
    const isScopeReadOnly = view === 'scope' && isActiveScopeCompleted;
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
    const scopeLabelOptions = useMemo(() => {
        const labelSet = new Set<string>();
        scopeListTasks.forEach((task) => {
            (task.kinds || []).forEach((kind) => {
                const value = String(kind || '').trim();
                if (value) labelSet.add(value);
            });
        });
        return Array.from(labelSet).sort((a, b) => a.localeCompare(b));
    }, [scopeListTasks]);
    const filteredScopeWindows = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const isExpired = (scope: ScopeWindow) => {
            if (!scope.endDate) return false;
            const end = new Date(scope.endDate);
            if (Number.isNaN(end.getTime())) return false;
            end.setHours(0, 0, 0, 0);
            return end < today;
        };
        const base =
            scopeTab === 'completed'
                ? scopeWindows.filter((scope) => Boolean(scope.completionStatus))
                : scopeTab === 'review'
                    ? scopeWindows.filter((scope) => !scope.completionStatus && isExpired(scope))
                    : scopeWindows.filter((scope) => !scope.completionStatus && !isExpired(scope));
        const sortByDate = (window: ScopeWindow) => {
            const stamp = window.startDate || window.createdAt;
            return stamp ? new Date(stamp).getTime() : 0;
        };
        const weeklyId = currentWeeklyScopeId;
        const weekly = weeklyId ? base.find((scope) => scope.id === weeklyId) : null;
        const rest = base.filter((scope) => scope.id !== weeklyId);
        rest.sort((a, b) => sortByDate(b) - sortByDate(a));
        return weekly ? [weekly, ...rest] : rest;
    }, [scopeTab, scopeWindows, currentWeeklyScopeId]);
    const scopeVisibleTasks = useMemo(() => {
        if (!activeScopeWindow) return [];
        const scopeUserId = userProfile?.id || session?.user?.id || '';
        return scopeListTasks.filter((task) => {
            if (filterFavorites && !task.isFavorite) return false;
            if (scopeFilterPriority !== 'ALL' && task.priority !== scopeFilterPriority) return false;
            if (scopeDetailView === 'list' && scopeFilterStatus !== 'ALL' && task.status !== scopeFilterStatus) return false;
            if (selectedLabelFilters.length > 0) {
                const taskLabels = (task.kinds || []).map((kind) => String(kind));
                const hasAny = selectedLabelFilters.some((label) => taskLabels.includes(label));
                if (!hasAny) return false;
            }
            if (quickFilter !== 'ALL') {
                const due = task.dueDate ? new Date(task.dueDate) : null;
                if (quickFilter === 'MINE') {
                    if (!scopeUserId) return false;
                    const isMine = task.ownerId === scopeUserId || (task.assignees || []).includes(scopeUserId);
                    if (!isMine) return false;
                }
                if (quickFilter === 'OVERDUE') {
                    if (!due) return false;
                    if (task.status === TaskStatus.DONE || task.status === TaskStatus.ARCHIVED) return false;
                    if (due >= new Date()) return false;
                }
                if (quickFilter === 'WEEK') {
                    if (!due) return false;
                    const now = new Date();
                    const end = new Date();
                    end.setDate(now.getDate() + 7);
                    if (task.status === TaskStatus.DONE || task.status === TaskStatus.ARCHIVED) return false;
                    if (due < now || due > end) return false;
                }
            }
            const normalizedScopeFilter = filterText.trim().toLowerCase();
            if (!normalizedScopeFilter) return true;
            const haystack = [
                task.title,
                stripHtml(task.description || ''),
                task.kinds.join(' ')
            ]
                .join(' ')
                .toLowerCase();
            return haystack.includes(normalizedScopeFilter);
        });
    }, [
        activeScopeWindow,
        scopeListTasks,
        filterFavorites,
        scopeFilterPriority,
        scopeFilterStatus,
        selectedLabelFilters,
        quickFilter,
        filterText,
        scopeDetailView,
        userProfile?.id,
        session?.user?.id,
    ]);
    const scopeOpenTaskIds = useMemo(() => {
        if (!activeScopeWindow) return [];
        return activeScopeWindow.taskIds.filter((taskId) => {
            const task = scopeTaskById.get(taskId);
            if (!task) return false;
            return task.status !== TaskStatus.DONE && task.status !== TaskStatus.ARCHIVED;
        });
    }, [activeScopeWindow, scopeTaskById]);
    const scopeBoardColumns = useMemo(() => {
        const statuses = [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.DONE];
        return statuses.map((status) => ({
            status,
            tasks: scopeVisibleTasks.filter((task) =>
                status === TaskStatus.TODO
                    ? task.status === TaskStatus.TODO || task.status === TaskStatus.BACKLOG
                    : task.status === status
            ),
        }));
    }, [scopeVisibleTasks]);
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
    const getStartOfWeek = (date: Date) => {
        const day = date.getDay();
        const diff = (day === 0 ? -6 : 1) - day;
        const start = new Date(date);
        start.setDate(date.getDate() + diff);
        start.setHours(0, 0, 0, 0);
        return start;
    };
    const renderTimeline = (items: TaskView[], emptyLabel: string) => {
        if (items.length === 0) {
            return <div className="timeline-empty">{emptyLabel}</div>;
        }
        const dates = items.flatMap((task) => {
            const override = timelineOverrides[task.id];
            const created = task.createdAt ? new Date(task.createdAt) : null;
            const overrideDue = override?.date ? new Date(override.date) : null;
            const taskDue = task.dueDate ? new Date(task.dueDate) : null;
            const effectiveDue = overrideDue || taskDue;
            const baseDurationDays = taskDue && created
                ? Math.max(1, Math.round((taskDue.getTime() - created.getTime()) / 86400000) + 1)
                : 1;
            const durationDays = override?.durationDays ?? baseDurationDays;
            const fallbackDate = created || effectiveDue || new Date();
            const start = effectiveDue
                ? new Date(effectiveDue.getTime() - (durationDays - 1) * 86400000)
                : fallbackDate;
            const end = start ? new Date(start.getTime() + (durationDays - 1) * 86400000) : null;
            return [start, end].filter(Boolean) as Date[];
        });
        const fallbackStart = getStartOfWeek(new Date());
        const minDate = dates.length > 0 ? new Date(Math.min(...dates.map((d) => d.getTime()))) : fallbackStart;
        const maxDate = dates.length > 0 ? new Date(Math.max(...dates.map((d) => d.getTime()))) : fallbackStart;
        const baseStart = timelineRange === 'auto' ? minDate : new Date();
        const timelineStart = getStartOfWeek(baseStart);
        const diffDays = Math.max(1, Math.ceil((maxDate.getTime() - timelineStart.getTime()) / 86400000) + 1);
        const totalDays = timelineRange === 'auto'
            ? Math.max(14, Math.min(31, diffDays))
            : Number(timelineRange);
        const timelineDays = Array.from({ length: totalDays }, (_, index) => {
            const next = new Date(timelineStart);
            next.setDate(timelineStart.getDate() + index);
            return next;
        });
        const dayWidth = 44;
        const toDayIndex = (date: Date) =>
            Math.max(0, Math.min(timelineDays.length - 1, Math.floor((date.getTime() - timelineStart.getTime()) / 86400000)));
        return (
            <div className="timeline-view">
                <div className="timeline-grid" style={{ ['--timeline-col' as any]: `${dayWidth}px` }}>
                    <div className="timeline-shell">
                        <div className="timeline-left">
                            <div className="timeline-header-title">Tasks</div>
                            <div className="timeline-left-rows">
                                {items.map((task) => (
                                    <div key={task.id} className="timeline-title">
                                        <span className="timeline-title-text">{task.title}</span>
                                        <span className="timeline-title-meta">
                                            <span className={`badge badge-priority-${task.priority.toLowerCase()}`}>
                                                {task.priority}
                                            </span>
                                            <span className="badge">
                                                {getStatusLabel(task.status)}
                                            </span>
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="timeline-right">
                            <div className="timeline-scroll" ref={timelineScrollRef}>
                                <div className="timeline-header-days" style={{ ['--timeline-days' as any]: timelineDays.length }}>
                                    {timelineDays.map((day, index) => {
                                        const isMonthStart = day.getDate() === 1 || index === 0;
                                        const monthLabel = isMonthStart
                                            ? new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' }).format(day)
                                            : '';
                                        const weekday = new Intl.DateTimeFormat('de-DE', { weekday: 'short' }).format(day);
                                        const dateLabel = String(day.getDate()).padStart(2, '0');
                                        return (
                                            <div key={day.toISOString()} className="timeline-day">
                                                <div className="timeline-day-month">{monthLabel}</div>
                                                <div className="timeline-day-row">
                                                    <span className="timeline-day-weekday">{weekday}</span>
                                                    <span className="timeline-day-date">{dateLabel}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="timeline-rows" style={{ ['--timeline-days' as any]: timelineDays.length }}>
                                    {items.map((task) => {
                                        const override = timelineOverrides[task.id];
                                        const created = task.createdAt ? new Date(task.createdAt) : new Date();
                                        const overrideDue = override?.date ? new Date(override.date) : null;
                                        const taskDue = task.dueDate ? new Date(task.dueDate) : null;
                                        const effectiveDue = overrideDue || taskDue;
                                        const baseDurationDays = taskDue
                                            ? Math.max(1, Math.round((taskDue.getTime() - created.getTime()) / 86400000) + 1)
                                            : 1;
                                        const durationDays = override?.durationDays ?? baseDurationDays;
                                        const start = new Date((effectiveDue || created).getTime() - (durationDays - 1) * 86400000);
                                        const startIndex = toDayIndex(start);
                                        let span = Math.max(1, durationDays);
                                        let dragOffset = timelineDragTaskId === task.id ? timelineDragOffsetDays : 0;
                                        let leftIndex = startIndex;
                                        if (timelineDragTaskId === task.id) {
                                            if (timelineDragMode === 'resize-end') {
                                                span = Math.max(1, durationDays + timelineDragOffsetDays);
                                                dragOffset = 0;
                                            } else if (timelineDragMode === 'resize-start') {
                                                span = Math.max(1, durationDays - timelineDragOffsetDays);
                                                leftIndex = startIndex + timelineDragOffsetDays;
                                                dragOffset = 0;
                                            }
                                        }
                                        const barStyle = {
                                            left: `calc(${leftIndex + dragOffset} * var(--timeline-col))`,
                                            width: `calc(${span} * var(--timeline-col))`,
                                        } as React.CSSProperties;
                                        return (
                                            <div key={task.id} className="timeline-track">
                                                <div
                                                    className={`timeline-bar priority-${task.priority.toLowerCase()}${timelineDragTaskId === task.id ? ' dragging' : ''}`}
                                                    style={barStyle}
                                                    onMouseDown={(event) => {
                                                        if (task.sourceType && task.sourceType !== 'MANUAL') return;
                                                        event.preventDefault();
                                                        setTimelineDragTaskId(task.id);
                                                        setTimelineDragOriginX(event.clientX);
                                                        setTimelineDragOriginDate(effectiveDue || created);
                                                        setTimelineDragOriginStart(start);
                                                        setTimelineDragOriginDuration(durationDays);
                                                        setTimelineDragOriginScroll(timelineScrollRef.current?.scrollLeft || 0);
                                                        setTimelineDragOffsetDays(0);
                                                        setTimelineDragIsPoint(false);
                                                        setTimelineDragDurationDays(durationDays);
                                                        setTimelineDragMode('move');
                                                    }}
                                                >
                                                    <div
                                                        className="timeline-resize-handle left"
                                                        onMouseDown={(event) => {
                                                            if (task.sourceType && task.sourceType !== 'MANUAL') return;
                                                            event.preventDefault();
                                                            event.stopPropagation();
                                                            setTimelineDragTaskId(task.id);
                                                            setTimelineDragOriginX(event.clientX);
                                                            setTimelineDragOriginDate(effectiveDue || created);
                                                            setTimelineDragOriginStart(start);
                                                            setTimelineDragOriginDuration(durationDays);
                                                            setTimelineDragOriginScroll(timelineScrollRef.current?.scrollLeft || 0);
                                                            setTimelineDragOffsetDays(0);
                                                            setTimelineDragIsPoint(false);
                                                            setTimelineDragDurationDays(durationDays);
                                                            setTimelineDragMode('resize-start');
                                                        }}
                                                    />
                                                    <div
                                                        className="timeline-resize-handle right"
                                                        onMouseDown={(event) => {
                                                            if (task.sourceType && task.sourceType !== 'MANUAL') return;
                                                            event.preventDefault();
                                                            event.stopPropagation();
                                                            setTimelineDragTaskId(task.id);
                                                            setTimelineDragOriginX(event.clientX);
                                                            setTimelineDragOriginDate(effectiveDue || created);
                                                            setTimelineDragOriginStart(start);
                                                            setTimelineDragOriginDuration(durationDays);
                                                            setTimelineDragOriginScroll(timelineScrollRef.current?.scrollLeft || 0);
                                                            setTimelineDragOffsetDays(0);
                                                            setTimelineDragIsPoint(false);
                                                            setTimelineDragDurationDays(durationDays);
                                                            setTimelineDragMode('resize-end');
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };
    useEffect(() => {
        if (!activeTenantId) {
            setActiveScopeId(null);
            return;
        }
        if (filteredScopeWindows.length === 0) {
            setActiveScopeId(null);
            return;
        }
        if (!activeScopeId || !filteredScopeWindows.some((window) => window.id === activeScopeId)) {
            setActiveScopeId(filteredScopeWindows[0].id);
        }
    }, [activeTenantId, filteredScopeWindows, activeScopeId]);
    useEffect(() => {
        if (!activeTenantId) {
            setActiveInitiativeId(null);
            return;
        }
        if (filteredInitiatives.length === 0) {
            setActiveInitiativeId(null);
            return;
        }
        if (!activeInitiativeId || !filteredInitiatives.some((initiative) => initiative.id === activeInitiativeId)) {
            setActiveInitiativeId(filteredInitiatives[0].id);
        }
    }, [activeTenantId, filteredInitiatives, activeInitiativeId]);
    useEffect(() => {
        setScopePickerOpenId(null);
        setScopePickerQuery('');
        setScopeInitiativeOpen(false);
    }, [activeScopeId]);
    useEffect(() => {
        setInitiativeScopePickerId('');
    }, [activeInitiativeId]);
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
        if (!activeTenantId || initiatives.length === 0) {
            setInitiativeScreen('list');
            return;
        }
        if (initiativeScreen === 'detail' && !activeInitiative) {
            setInitiativeScreen('list');
        }
    }, [activeTenantId, initiatives.length, activeInitiative, initiativeScreen]);
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
        if (!initiativeRouteId) return;
        if (initiatives.length === 0) return;
        const match = initiatives.find((initiative) => initiative.id === initiativeRouteId);
        if (match) {
            setActiveInitiativeId(match.id);
            setInitiativeScreen('detail');
            return;
        }
        setInitiativeRouteId(null);
        updateInitiativeUrl(null, 'replace');
        setInitiativeScreen('list');
    }, [initiativeRouteId, initiatives]);
    useEffect(() => {
        if (view !== 'scope' && scopeRouteId) {
            setScopeRouteId(null);
            updateScopeUrl(null, 'replace');
        }
    }, [view, scopeRouteId]);
    useEffect(() => {
        if (view !== 'initiatives' && initiativeRouteId) {
            setInitiativeRouteId(null);
            updateInitiativeUrl(null, 'replace');
        }
    }, [view, initiativeRouteId]);
    useEffect(() => {
        if (!activeTenantId || !currentWeeklyScopeId) return;
        ensureCurrentWeeklyScope();
    }, [activeTenantId, currentWeeklyScopeId]);
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
            visibility: activeScopeWindow.visibility === 'personal' ? 'personal' : 'shared',
            members: (activeScopeWindow.members || []).map((member) => ({
                userId: member.userId,
                role: member.role,
            })),
        });
        setScopeMemberPickerId('');
        setScopeMemberPickerRole('MEMBER');
    }, [isScopeSettingsOpen, activeScopeWindow]);
    useEffect(() => {
        if (!activeScopeWindow) {
            setScopeCompletionStatus('');
            setScopeCompletionComment('');
            setScopeCompletionTargetId('');
            return;
        }
        setScopeCompletionStatus(activeScopeWindow.completionStatus || '');
        setScopeCompletionComment(activeScopeWindow.completionComment || '');
        setScopeCompletionTargetId('');
    }, [activeScopeWindow]);
    useEffect(() => {
        if (!isScopeCreateOpen) {
            setInitiativeScopeCreateForId(null);
        }
    }, [isScopeCreateOpen]);
    const updateScopeWindows = (updater: (prev: ScopeWindow[]) => ScopeWindow[]) => {
        if (!scopeKey) return;
        setScopeWindowsByBoard((prev) => {
            const current = prev[scopeKey] || [];
            const next = updater(current);
            // Persist immediately so scope taskIds are saved even if effects are skipped.
            saveScopesForTenant(scopeKey, next);
            return { ...prev, [scopeKey]: next };
        });
    };
    const ensureCurrentWeeklyScope = () => {
        if (!activeTenantId) return null;
        const weekStart = getWeekStart(new Date());
        const weekEnd = getWeekEnd(weekStart);
        const weeklyKey = buildWeeklyScopeKey(activeTenantId, weekStart);
        const weeklyId = `${WEEKLY_SCOPE_PREFIX}${weeklyKey}`;
        const existing = (scopeWindowsByBoard[activeTenantId] || []).find((window) => window.id === weeklyId);
        if (existing) return existing;
        const weekNumber = getWeekNumber(weekStart);
        const nextWindow: ScopeWindow = {
            id: weeklyId,
            name: `Diese Woche (KW ${weekNumber})`,
            description: 'Auto-created weekly focus window',
            startDate: toISODate(weekStart),
            endDate: toISODate(weekEnd),
            taskIds: [],
            createdAt: new Date().toISOString(),
            visibility: 'shared',
        };
        updateScopeWindows((prev) => {
            if (prev.some((window) => window.id === weeklyId)) return prev;
            return [nextWindow, ...prev];
        });
        return nextWindow;
    };
    const createInitiativeId = () => {
        if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
            return crypto.randomUUID();
        }
        return `initiative-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    };
    const updateInitiatives = (tenantId: string, updater: (prev: Initiative[]) => Initiative[]) => {
        setInitiativesByTenant((prev) => {
            const current = prev[tenantId] || [];
            const next = updater(current);
            return { ...prev, [tenantId]: next };
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
                        visibility: scopeSettingsDraft.visibility,
                        members: scopeSettingsDraft.members,
                    }
                    : window
            )
        );
        setIsScopeSettingsOpen(false);
    };
    const refreshScopeTasksForTenant = async (tenantId: string) => {
        try {
            if (!session?.access_token) return;
            if (scopeTasksFetchInFlightRef.current[tenantId]) return;
            scopeTasksFetchInFlightRef.current[tenantId] = true;
            const res = await fetch(`${API_BASE}/tasks?boardId=all`, { headers: getApiHeaders(true, tenantId) });
            if (!res.ok) return;
            const data = await res.json();
            setScopeTasksByTenant((prev) => ({ ...prev, [tenantId]: data }));
        } catch {
            // ignore
        } finally {
            scopeTasksFetchInFlightRef.current[tenantId] = false;
        }
    };
    const handleScopeClose = () => {
        if (!activeScopeWindow) return;
        if (!canManageScopeById(activeScopeWindow.id)) return;
        if (currentWeeklyScopeId && activeScopeWindow.id === currentWeeklyScopeId) {
            alert('Der aktuelle Wochen-Scope kann nicht abgeschlossen werden.');
            return;
        }
        if (!scopeCompletionStatus) {
            alert('Bitte Ziel erreicht auswählen.');
            return;
        }
        if (scopeOpenTaskIds.length > 0 && !scopeCompletionTargetId) {
            alert('Bitte einen Ziel-Scope für offene Tasks auswählen.');
            return;
        }
        const nowIso = new Date().toISOString();
        const actorId = userProfile?.id || session?.user?.id || null;
        const targetId = scopeCompletionTargetId;
        const openIds = scopeOpenTaskIds;
        updateScopeWindows((prev) =>
            prev.map((window) => {
                if (window.id === activeScopeWindow.id) {
                    const remaining = window.taskIds.filter((id) => !openIds.includes(id));
                    return {
                        ...window,
                        taskIds: remaining,
                        completionStatus: scopeCompletionStatus,
                        completionComment: scopeCompletionComment.trim() || null,
                        completedAt: window.completedAt || nowIso,
                        completedBy: actorId,
                    };
                }
                if (targetId && window.id === targetId && openIds.length > 0) {
                    const nextIds = window.taskIds.concat(openIds.filter((id) => !window.taskIds.includes(id)));
                    return { ...window, taskIds: nextIds };
                }
                return window;
            })
        );
        setScopeCompletionTargetId('');
        setToastMessage('Scope abgeschlossen');
        setIsScopeCloseOpen(false);
    };
    const sidebarBoardItems = useMemo(() => {
        const list = activeTenantId ? (boardsByTenant[activeTenantId] || boards) : boards;
        const items: Array<{ id: string; name: string }> = [];
        const pushUnique = (item: { id: string; name: string }) => {
            if (!items.some((entry) => entry.id === item.id)) {
                items.push(item);
            }
        };
        (Array.isArray(list) ? list : []).forEach((boardItem) => {
            if (boardItem?.id) {
                pushUnique({ id: boardItem.id, name: boardItem.name || 'Tasks' });
            }
        });
        return items;
    }, [activeTenantId, boardsByTenant, boards]);
    const getWritableBoards = (tenantId?: string | null) => {
        const list = tenantId
            ? (boardsByTenant[tenantId] || (tenantId === activeTenantId ? boards : []))
            : boards;
        const safeList = (list || []).filter(
            (item) => item?.id !== ARCHIVED_BOARD_ID && item?.id !== ALL_BOARD_ID && item?.id !== OWN_BOARD_ID
        );
        return safeList;
    };
    const resolveWritableBoardId = (tenantId?: string | null) => {
        const list = getWritableBoards(tenantId);
        if (
            tenantId === activeTenantId
            && activeBoardId
            && activeBoardId !== ARCHIVED_BOARD_ID
            && activeBoardId !== ALL_BOARD_ID
            && activeBoardId !== OWN_BOARD_ID
        ) {
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
        setNewTaskScopeId(null);
        setNewTaskOwnerId(userProfile?.id || null);
        setNewTaskAssignees([]);
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
    const isSuperAdmin = Boolean(userProfile?.isSuperAdmin);
    useEffect(() => {
        if (!activeTenantId) return;
        const scopes = scopeWindowsByBoard[activeTenantId];
        if (!scopes) return;
        if (scopeSyncRef.current.skipNextSave && scopeSyncRef.current.tenantId === activeTenantId) {
            scopeSyncRef.current = { tenantId: activeTenantId, skipNextSave: false };
            return;
        }
        saveScopesForTenant(activeTenantId, scopes);
    }, [activeTenantId, scopeWindowsByBoard]);
    const allTasks = useMemo(() => {
        if (activeTenantId && tasksByTenant[activeTenantId]) {
            return tasksByTenant[activeTenantId] || [];
        }
        return tasks;
    }, [activeTenantId, tasksByTenant, tasks]);
    const greetingLabel = useMemo(() => {
        const name = (settingsDraft?.name || userProfile?.name || currentUserLabel || '').trim();
        const firstName = name.split(/\s+/)[0] || 'there';
        const hour = new Date().getHours();
        if (hour < 12) return `Guten Morgen, ${firstName}`;
        if (hour < 18) return `Guten Tag, ${firstName}`;
        return `Guten Abend, ${firstName}`;
    }, [settingsDraft?.name, userProfile?.name, currentUserLabel]);
    const focusCount = useMemo(() => {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        return allTasks.filter((task) => {
            if (!task.dueDate) return false;
            if (task.status === TaskStatus.DONE || task.status === TaskStatus.ARCHIVED) return false;
            const due = new Date(task.dueDate);
            return due >= start && due <= end;
        }).length;
    }, [allTasks]);
    const focusTasksToday = useMemo(() => {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        return allTasks.filter((task) => {
            if (!task.dueDate) return false;
            if (task.status === TaskStatus.DONE || task.status === TaskStatus.ARCHIVED) return false;
            const due = new Date(task.dueDate);
            return due >= start && due <= end;
        });
    }, [allTasks]);
    const isSpecialSidebarBoard = (boardId?: string | null) =>
        boardId === ARCHIVED_BOARD_ID || boardId === ALL_BOARD_ID || boardId === OWN_BOARD_ID;
    const renderSidebarBoardIcon = (boardId?: string | null, compact = false) => {
        if (!boardId) return <span className="sidebar-board-dot" aria-hidden="true" />;
        if (boardId === OWN_BOARD_ID) {
            return (
                <span
                    className={`sidebar-board-icon sidebar-board-avatar${compact ? ' compact' : ''}`}
                    style={{
                        background: activeHuddleAccent?.solid || 'var(--accent-primary)',
                        color: activeHuddleAccent?.text || '#0f172a',
                        borderColor: activeHuddleAccent?.border || 'rgba(30, 30, 30, 0.2)',
                    }}
                    aria-hidden="true"
                >
                    {currentUserAvatar ? <img src={currentUserAvatar} alt="" /> : currentUserInitial}
                </span>
            );
        }
        if (boardId === ARCHIVED_BOARD_ID) {
            return (
                <span className={`sidebar-board-icon${compact ? ' compact' : ''}`} aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6">
                        <rect x="3.5" y="4" width="17" height="5" rx="1.5" />
                        <path d="M6 9h12v9a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9z" />
                        <path d="M9 13h6" />
                    </svg>
                </span>
            );
        }
        if (boardId === ALL_BOARD_ID) {
            return (
                <span className={`sidebar-board-icon${compact ? ' compact' : ''}`} aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6">
                        <rect x="4" y="4.5" width="7" height="7" rx="2" />
                        <rect x="13" y="4.5" width="7" height="7" rx="2" />
                        <rect x="4" y="13" width="16" height="7" rx="2" />
                    </svg>
                </span>
            );
        }
        return <span className="sidebar-board-dot" aria-hidden="true" />;
    };
    const quickPinItems = useMemo(() => {
        return allTasks
            .filter((task) => task.isFavorite && task.status !== TaskStatus.ARCHIVED)
            .slice(0, 5)
            .map((task) => ({
                id: task.id,
                label: task.title,
                sublabel: getBoardLabel(task.boardId),
            }));
    }, [allTasks]);
    const breadcrumbItems = useMemo(() => {
        if (view === 'settings') {
            return [{ label: 'Settings' }];
        }
        const huddleLabel = activeHuddleName || 'Huddle';
        const items: Array<{ label: string; onClick?: () => void }> = [
            { label: huddleLabel, onClick: () => setView('dashboard') },
        ];
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
        if (view === 'initiatives') {
            items.push({
                label: 'Initiatives',
                onClick: () => {
                    setView('initiatives');
                    setInitiativeScreen('list');
                    setInitiativeRouteId(null);
                    updateInitiativeUrl(null, 'replace');
                }
            });
            if (initiativeScreen === 'detail' && activeInitiative) {
                items.push({ label: activeInitiative.name });
            }
            return items;
        }
        if (view === 'table') items.push({ label: activeBoard?.name ? `Table · ${activeBoard.name}` : 'Table', onClick: () => setView('table') });
        if (view === 'list') items.push({ label: activeBoard?.name ? `Table · ${activeBoard.name}` : 'Table', onClick: () => setView('table') });
        if (view === 'kanban') items.push({ label: activeBoard?.name || 'Tasks', onClick: () => setView('kanban') });
        return items;
    }, [view, activeHuddleName, activeBoard?.name, scopeScreen, activeScopeWindow, initiativeScreen, activeInitiative]);
    const notificationSnapshotRef = useRef<Record<string, any>>({});
    const initializedHuddlesRef = useRef<Set<string>>(new Set());
    const inviteSnapshotRef = useRef<Set<string>>(new Set());
    const currentUserId = userProfile?.id || session?.user?.id || '';
    const inboxItems = useMemo(() => {
        const currentLabel = String(userProfile?.email || session?.user?.email || '');
        const filteredCustom = activeTenantId
            ? inboxCustomItems.filter((item) => !item.tenantId || item.tenantId === activeTenantId)
            : inboxCustomItems;
        return filteredCustom.filter((item) => {
            if (!currentUserId) return false;
            if (item.creatorId) return item.creatorId === currentUserId;
            return item.creatorLabel ? item.creatorLabel === currentLabel : false;
        });
    }, [inboxCustomItems, activeTenantId, currentUserId, userProfile?.email, session?.user?.email]);
    const inboxCounts = useMemo(() => {
        const counts: Record<InboxStatus, number> = {
            eingang: 0,
            spaeter: 0,
            bearbeitet: 0,
            archiv: 0,
        };
        inboxItems.forEach((item) => {
            const status = inboxItemStatuses[item.id] || 'eingang';
            counts[status] += 1;
        });
        return counts;
    }, [inboxItems, inboxItemStatuses]);
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

    async function loadScopesForTenant(tenantId: string, localFallback: ScopeWindow[] = []) {
        try {
            if (!session?.access_token) return;
            if (scopesFetchInFlightRef.current[tenantId]) return;
            scopesFetchInFlightRef.current[tenantId] = true;
            scopeSyncRef.current = { tenantId, skipNextSave: true };
            const res = await fetch(`${API_BASE}/teams/${tenantId}/scopes`, {
                headers: getApiHeaders(true, tenantId),
            });
            if (!res.ok) return;
            const data = await res.json();
            const localInitiativeMap = new Map<string, string | null>(
                localFallback.map((scope) => [scope.id, scope.initiativeId ?? null])
            );
            const scopes = Array.isArray(data?.scopes)
                ? data.scopes.map((scope: ScopeWindow) => ({
                    ...scope,
                    visibility: scope.visibility === 'personal' ? 'personal' : 'shared',
                    createdBy: scope.createdBy || null,
                    completionStatus: scope.completionStatus || null,
                    completionComment: scope.completionComment || null,
                    completedAt: scope.completedAt || null,
                    completedBy: scope.completedBy || null,
                    initiativeId: localInitiativeMap.get(scope.id) ?? scope.initiativeId ?? null,
                    role: scope.role || 'VIEWER',
                    members: Array.isArray(scope.members)
                        ? scope.members.map((member) => ({
                            userId: member.userId,
                            role: member.role === 'ADMIN' || member.role === 'MEMBER' ? member.role : 'VIEWER',
                        }))
                        : [],
                }))
                : [];
            if (
                scopes.length === 0
                && localFallback.length > 0
                && (isActiveHuddleOwner || isSuperAdmin)
            ) {
                await saveScopesForTenant(tenantId, localFallback);
                scopeSyncRef.current = { tenantId, skipNextSave: true };
                setScopeWindowsByBoard((prev) => ({ ...prev, [tenantId]: localFallback }));
                return;
            }
            setScopeWindowsByBoard((prev) => ({ ...prev, [tenantId]: scopes }));
        } catch {
            // ignore
        } finally {
            scopesFetchInFlightRef.current[tenantId] = false;
        }
    }

    const resolveLocalScopeFallback = (tenantId: string) => {
        const direct = scopeWindowsByBoard[tenantId] || [];
        if (direct.length > 0) return direct;
        if (!memberships || memberships.length !== 1) return [];
        const tenantIds = new Set(memberships.map((membership) => membership.tenantId));
        const legacyScopes = Object.entries(scopeWindowsByBoard)
            .filter(([key]) => !tenantIds.has(key))
            .flatMap(([, scopes]) => scopes);
        if (legacyScopes.length > 0) {
            setScopeWindowsByBoard((prev) => ({ ...prev, [tenantId]: legacyScopes }));
        }
        return legacyScopes;
    };

    async function saveScopesForTenant(tenantId: string, scopes: ScopeWindow[]) {
        try {
            if (!session?.access_token) return;
            const res = await fetch(`${API_BASE}/teams/${tenantId}/scopes`, {
                method: 'PUT',
                headers: getApiHeaders(true, tenantId),
                body: JSON.stringify({
                    scopes: scopes.map((scope) => ({
                        ...scope,
                        visibility: scope.visibility === 'personal' ? 'personal' : 'shared',
                        createdBy: scope.createdBy || null,
                        completionStatus: scope.completionStatus || null,
                        completionComment: scope.completionComment || null,
                        completedAt: scope.completedAt || null,
                        completedBy: scope.completedBy || null,
                        members: Array.isArray(scope.members) ? scope.members : [],
                    })),
                }),
            });
            if (res.ok) {
                await scopeBroadcastChannelRef.current?.send({
                    type: 'broadcast',
                    event: 'scope-update',
                    payload: { tenantId },
                });
            }
        } catch {
            // ignore
        }
    }

    const handleRenameHuddle = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeTenantId) return;
        const nextName = huddleRenameInput.trim();
        if (!nextName) return;
        setTeamError(null);
        setHuddleRenameSaving(true);
        try {
            const res = await fetch(`${API_BASE}/teams/${activeTenantId}`, {
                method: 'PATCH',
                headers: getApiHeaders(true),
                body: JSON.stringify({ name: nextName }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to rename huddle');
            }
            const updated = await res.json();
            setMemberships((prev) =>
                prev.map((membership) =>
                    membership.tenantId === activeTenantId
                        ? { ...membership, tenant: { ...(membership.tenant || {}), name: updated.name } }
                        : membership
                )
            );
            setToastMessage('Huddle renamed');
        } catch (err: any) {
            setTeamError(err.message);
        } finally {
            setHuddleRenameSaving(false);
        }
    };

    const loadMembersForHuddle = async (tenantId: string | null | undefined) => {
        if (!tenantId || huddleMembersByTenant[tenantId] || !session?.access_token) return;
        if (membersFetchInFlightRef.current[tenantId]) return;
        membersFetchInFlightRef.current[tenantId] = true;
        try {
            const res = await fetch(`${API_BASE}/teams/${tenantId}/members`, { headers: getApiHeaders(false) });
            if (!res.ok) throw new Error('Failed to load members');
            const data = await res.json();
            setHuddleMembersByTenant((prev) => ({ ...prev, [tenantId]: data }));
        } catch (err: any) {
            setTeamError(err.message);
        } finally {
            membersFetchInFlightRef.current[tenantId] = false;
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
            if (activeTenantId) {
                loadTeamMembers(activeTenantId);
                loadInboxForTenant(activeTenantId, inboxCustomItems, inboxItemStatuses);
            }
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
        if (!session?.access_token || !activeTenantId) return;
        let cancelled = false;
        const poll = async () => {
            if (pollInFlightRef.current) return;
            pollInFlightRef.current = true;
            const membership = displayMemberships.find((item) => item.tenantId === activeTenantId);
            const huddleName = getHuddleName(membership?.tenant?.name);
            try {
                const res = await fetch(`${API_BASE}/tasks`, { headers: getApiHeaders(true, activeTenantId) });
                if (res.ok) {
                    const data = await res.json();
                    if (!cancelled) {
                        setTasksByTenant((prev) => ({ ...prev, [activeTenantId]: data }));
                        handleTaskNotifications(activeTenantId, huddleName, data);
                    }
                }
            } catch {
                // Ignore polling errors
            }
            pollInFlightRef.current = false;
        };
        const initialDelay = window.setTimeout(poll, 8000);
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
        }
        pollIntervalRef.current = window.setInterval(poll, 30000);
        return () => {
            cancelled = true;
            pollInFlightRef.current = false;
            clearTimeout(initialDelay);
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
            }
        };
    }, [session?.access_token, displayMemberships, activeTenantId]);

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
        if (!isSpecialBoard) {
            (board?.columns || []).forEach((column: any) => {
                if (column?.status) options.add(String(column.status));
            });
        }
        if (options.size === 0) {
            tasks.forEach((task) => {
                if (task.status && task.status !== TaskStatus.ARCHIVED) {
                    options.add(task.status);
                }
            });
        }
        return ['ALL', ...Array.from(options)];
    }, [board?.columns, tasks, isArchivedBoard, isSpecialBoard]);

    const labelFilterOptions = useMemo(() => {
        const sourceTasks = isArchivedBoard
            ? tasks.filter((task) => task.status === TaskStatus.ARCHIVED)
            : tasks.filter((task) => task.status !== TaskStatus.ARCHIVED);
        const labelSet = new Set<string>();
        sourceTasks.forEach((task) => {
            (task.kinds || []).forEach((kind) => {
                const value = String(kind || '').trim();
                if (value) labelSet.add(value);
            });
        });
        return Array.from(labelSet).sort((a, b) => a.localeCompare(b));
    }, [tasks, isArchivedBoard]);

    useEffect(() => {
        setSelectedLabelFilters((prev) => prev.filter((label) => labelFilterOptions.includes(label)));
    }, [labelFilterOptions]);

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
    useEffect(() => {
        if (labelFilterOpen && (view === 'dashboard' || view === 'scope')) {
            setLabelFilterOpen(false);
        }
    }, [view, labelFilterOpen]);
    useEffect(() => {
        if (view === 'dashboard' && labelFilterOpen) {
            setLabelFilterOpen(false);
        }
    }, [view, labelFilterOpen]);

    const normalizedFilter = filterText.trim().toLowerCase();
    const matchesFilter = (task: TaskView) => {
        if (filterFavorites && !task.isFavorite) return false;
        if (filterPriority !== 'ALL' && task.priority !== filterPriority) return false;
        if (view === 'table' && filterStatus !== 'ALL' && task.status !== filterStatus) return false;
        if (selectedLabelFilters.length > 0) {
            const taskLabels = (task.kinds || []).map((kind) => String(kind));
            const hasAny = selectedLabelFilters.some((label) => taskLabels.includes(label));
            if (!hasAny) return false;
        }
        if (quickFilter !== 'ALL') {
            const due = task.dueDate ? new Date(task.dueDate) : null;
            if (quickFilter === 'MINE') {
                if (!currentUserId) return false;
                const isMine = task.ownerId === currentUserId || (task.assignees || []).includes(currentUserId);
                if (!isMine) return false;
            }
            if (quickFilter === 'OVERDUE') {
                if (!due) return false;
                if (task.status === TaskStatus.DONE || task.status === TaskStatus.ARCHIVED) return false;
                if (due >= new Date()) return false;
            }
            if (quickFilter === 'WEEK') {
                if (!due) return false;
                const now = new Date();
                const end = new Date();
                end.setDate(now.getDate() + 7);
                if (task.status === TaskStatus.DONE || task.status === TaskStatus.ARCHIVED) return false;
                if (due < now || due > end) return false;
            }
        }
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
    const baseBoardTasks = isArchivedBoard
        ? tasks.filter((task) => task.status === TaskStatus.ARCHIVED)
        : tasks.filter((task) => task.status !== TaskStatus.ARCHIVED);
    const filteredTasks = baseBoardTasks.filter(matchesFilter);
    const visibleTasksForView = filteredTasks;
    const kanbanColumns = isArchivedBoard
        ? [{ status: TaskStatus.ARCHIVED, tasks: visibleTasksForView }]
        : [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.DONE].map((status) => ({
            status,
            tasks: baseBoardTasks.filter((task) =>
                status === TaskStatus.TODO
                    ? task.status === TaskStatus.TODO || task.status === TaskStatus.BACKLOG
                    : task.status === status
            ),
        }));
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

            let createdTaskId: string | null = null;
            try {
                const data = await res.json();
                createdTaskId = data?.task?.id || data?.id || data?.taskId || null;
            } catch {
                createdTaskId = null;
            }
            const targetScopeId = newTaskScopeId || scopeTaskCreateTargetId;
            if (createdTaskId && targetScopeId) {
                handleScopeAddTask(targetScopeId, createdTaskId);
                setScopeTaskCreateTargetId(null);
                setNewTaskScopeId(null);
                setToastMessage('Task created in scope');
            }

            setIsModalOpen(false);
            setScopeTaskCreateTargetId(null);
            setNewTask({ title: '', description: '', priority: 'MEDIUM', dueDate: '' });
            setNewTaskAttachments([]);
            setNewTaskKinds([]);
            setNewKindInput('');
            setNewTaskBoardId(null);
            setNewTaskScopeId(null);
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

    const openScopeTaskModal = () => {
        if (!activeScopeWindow || !activeTenantId) return;
        setScopeTaskCreateTargetId(activeScopeWindow.id);
        setNewTaskHuddleId(activeTenantId);
        setNewTaskBoardId(resolveWritableBoardId(activeTenantId));
        setNewTask({ title: '', description: '', priority: 'MEDIUM', dueDate: toDateInput(activeScopeWindow.endDate) });
        setNewTaskKinds([]);
        setNewKindInput('');
        setNewTaskAttachments([]);
        setNewTaskStatus(TaskStatus.BACKLOG);
        setNewTaskOwnerId(userProfile?.id ?? null);
        setNewTaskAssignees([]);
        setNewTaskScopeId(activeScopeWindow.id);
        setIsModalOpen(true);
    };

    const updateTaskStatusLocal = (taskId: string, newStatus: TaskStatus) => {
        setTasks((prev) =>
            prev.map((task) => (task.id === taskId ? { ...task, status: newStatus } : task))
        );
        if (activeTenantId) {
            setTasksByTenant((prev) => {
                const list = prev[activeTenantId];
                if (!list) return prev;
                return {
                    ...prev,
                    [activeTenantId]: list.map((task) =>
                        task.id === taskId ? { ...task, status: newStatus } : task
                    ),
                };
            });
            setScopeTasksByTenant((prev) => {
                const list = prev[activeTenantId];
                if (!list) return prev;
                return {
                    ...prev,
                    [activeTenantId]: list.map((task) =>
                        task.id === taskId ? { ...task, status: newStatus } : task
                    ),
                };
            });
        }
    };

    const handleUpdateStatus = async (taskId: string, newStatus: TaskStatus) => {
        const currentTask = tasks.find((task) => task.id === taskId);
        const previousStatus = currentTask?.status;
        if (previousStatus && previousStatus !== newStatus) {
            updateTaskStatusLocal(taskId, newStatus);
        }
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
            if (activeTenantId) {
                await tasksBroadcastChannelRef.current?.send({
                    type: 'broadcast',
                    event: 'task-update',
                    payload: { tenantId: activeTenantId, taskId },
                });
            }
        } catch (e: any) {
            if (previousStatus && previousStatus !== newStatus) {
                updateTaskStatusLocal(taskId, previousStatus);
            }
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
        if (view === 'scope' && activeScopeWindow?.completionStatus) return;
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
        const scopedWindow = activeScopeWindow?.taskIds.includes(task.id)
            ? activeScopeWindow
            : scopeWindows.find((window) => window.taskIds.includes(task.id)) || null;
        const scopeId = scopedWindow?.id || null;
        setEditTaskScopeId(scopeId);
        setEditTaskScopeOriginal(scopeId);
        setIsEditModalOpen(true);
    };

    const closeCreateTaskModal = () => {
        setIsModalOpen(false);
        setNewTaskAttachments([]);
        setNewTaskKinds([]);
        setNewKindInput('');
        setNewTaskBoardId(null);
        setNewTaskScopeId(null);
        setScopeTaskCreateTargetId(null);
    };

    const closeDetailsModal = () => {
        setIsDetailsModalOpen(false);
        setSelectedTaskId(null);
    };

    const closeEditTaskModal = () => {
        setIsEditModalOpen(false);
        setEditingTaskId(null);
        setNewAttachments([]);
        setRemovedAttachmentIds([]);
        setEditTaskKinds([]);
        setEditKindInput('');
        setChecklistDraft([]);
        setChecklistInput('');
        setEditTaskScopeId(null);
        setEditTaskScopeOriginal(null);
    };

    const closeKrComposer = () => {
        setKrComposerOpen(false);
        setKrComposerObjectiveId(null);
        setKrEditingId(null);
    };

    const closeObjectiveSettings = () => {
        setIsObjectiveSettingsOpen(false);
        setObjectiveEditId(null);
    };

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            let handled = false;

            if (imagePreview) {
                setImagePreview(null);
                handled = true;
            } else if (isEditModalOpen) {
                closeEditTaskModal();
                handled = true;
            } else if (isDetailsModalOpen) {
                closeDetailsModal();
                handled = true;
            } else if (inboxCaptureOpen) {
                setInboxCaptureOpen(false);
                handled = true;
            } else if (inboxPriorityOpen) {
                setInboxPriorityOpen(false);
                handled = true;
            } else if (isModalOpen) {
                closeCreateTaskModal();
                handled = true;
            } else if (krComposerOpen) {
                closeKrComposer();
                handled = true;
            } else if (objectiveComposerOpen) {
                setObjectiveComposerOpen(false);
                handled = true;
            } else if (isObjectiveSettingsOpen) {
                closeObjectiveSettings();
                handled = true;
            } else if (isScopeSettingsOpen) {
                setIsScopeSettingsOpen(false);
                handled = true;
            } else if (isScopeCreateOpen) {
                setIsScopeCreateOpen(false);
                handled = true;
            } else if (isBoardSettingsOpen) {
                setIsBoardSettingsOpen(false);
                handled = true;
            } else if (isInvitesModalOpen) {
                setIsInvitesModalOpen(false);
                handled = true;
            } else if (isTeamModalOpen) {
                setIsTeamModalOpen(false);
                handled = true;
            } else if (isNotificationsOpen) {
                setIsNotificationsOpen(false);
                handled = true;
            } else if (isFocusDropdownOpen) {
                setIsFocusDropdownOpen(false);
                handled = true;
            } else if (isUserMenuOpen) {
                setIsUserMenuOpen(false);
                handled = true;
            } else if (isHuddleMenuOpen) {
                setIsHuddleMenuOpen(false);
                handled = true;
            } else if (boardMenuOpen) {
                setBoardMenuOpen(false);
                handled = true;
            } else if (okrMenuOpen) {
                setOkrMenuOpen(false);
                handled = true;
            } else if (scopeMenuOpen) {
                setScopeMenuOpen(false);
                handled = true;
            } else if (isQuickPinsOpen) {
                setIsQuickPinsOpen(false);
                handled = true;
            } else if (inboxScopeMenuId) {
                setInboxScopeMenuId(null);
                handled = true;
            } else if (scopePickerOpenId) {
                setScopePickerOpenId(null);
                handled = true;
            } else if (scopePriorityFilterOpen) {
                setScopePriorityFilterOpen(false);
                handled = true;
            } else if (scopeStatusFilterOpen) {
                setScopeStatusFilterOpen(false);
                handled = true;
            } else if (priorityFilterOpen) {
                setPriorityFilterOpen(false);
                handled = true;
            } else if (statusFilterOpen) {
                setStatusFilterOpen(false);
                handled = true;
            } else if (labelFilterOpen) {
                setLabelFilterOpen(false);
                handled = true;
            } else if (openMemberDropdownId) {
                setOpenMemberDropdownId(null);
                handled = true;
            } else if (timelineRangeOpen) {
                setTimelineRangeOpen(false);
                handled = true;
            }

            if (handled) {
                event.preventDefault();
                event.stopPropagation();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [
        imagePreview,
        isEditModalOpen,
        isDetailsModalOpen,
        isModalOpen,
        krComposerOpen,
        objectiveComposerOpen,
        isObjectiveSettingsOpen,
        isScopeSettingsOpen,
        isBoardSettingsOpen,
        isInvitesModalOpen,
        isTeamModalOpen,
        isNotificationsOpen,
        isUserMenuOpen,
        isHuddleMenuOpen,
        boardMenuOpen,
        okrMenuOpen,
        scopeMenuOpen,
        scopePickerOpenId,
        scopePriorityFilterOpen,
        scopeStatusFilterOpen,
        priorityFilterOpen,
        statusFilterOpen,
        inboxPriorityOpen,
        timelineRangeOpen,
        inboxScopeMenuId,
        inboxSourceOpen,
        inboxActionOpen,
        closeCreateTaskModal,
        closeDetailsModal,
        closeEditTaskModal,
        closeKrComposer,
        closeObjectiveSettings,
    ]);

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

    const updateTaskDueDateLocal = (tenantId: string, taskId: string, dueDate: string | Date | null) => {
        const nextDueDate = dueDate
            ? typeof dueDate === 'string'
                ? new Date(dueDate)
                : dueDate
            : undefined;
        setTasksByTenant((prev) => {
            const tenantTasks = prev[tenantId];
            if (!tenantTasks) return prev;
            return {
                ...prev,
                [tenantId]: tenantTasks.map((item) =>
                    item.id === taskId ? { ...item, dueDate: nextDueDate } : item
                ),
            };
        });
        setScopeTasksByTenant((prev) => {
            const tenantTasks = prev[tenantId];
            if (!tenantTasks) return prev;
            return {
                ...prev,
                [tenantId]: tenantTasks.map((item) =>
                    item.id === taskId ? { ...item, dueDate: nextDueDate } : item
                ),
            };
        });
        setTasks((prev) =>
            prev.map((item) => (item.id === taskId ? { ...item, dueDate: nextDueDate } : item))
        );
    };

    useEffect(() => {
        if (!timelineDragTaskId || !timelineDragOriginDate) return;
        const dayWidth = 44;
        const handleMove = (event: MouseEvent) => {
            const scrollDelta =
                (timelineScrollRef.current?.scrollLeft || 0) - timelineDragOriginScroll;
            const deltaX = event.clientX - timelineDragOriginX + scrollDelta;
            const offset = Math.round(deltaX / dayWidth);
            setTimelineDragOffsetDays(offset);
        };
        const handleUp = async () => {
            const task = taskById.get(timelineDragTaskId);
            if (!task || !timelineDragOriginDate) {
                setTimelineDragTaskId(null);
                setTimelineDragOffsetDays(0);
                return;
            }
            if (timelineDragOffsetDays !== 0) {
                let nextDate = new Date(timelineDragOriginDate);
                let nextDuration = timelineDragDurationDays;
                if (!timelineDragIsPoint) {
                    const originStart = timelineDragOriginStart || new Date(timelineDragOriginDate);
                    const originDuration = timelineDragOriginDuration || timelineDragDurationDays;
                    if (timelineDragMode === 'resize-end') {
                        nextDuration = Math.max(1, originDuration + timelineDragOffsetDays);
                        nextDate = new Date(originStart);
                        nextDate.setDate(nextDate.getDate() + nextDuration - 1);
                    } else if (timelineDragMode === 'resize-start') {
                        nextDuration = Math.max(1, originDuration - timelineDragOffsetDays);
                        nextDate = new Date(originStart);
                        nextDate.setDate(nextDate.getDate() + originDuration - 1);
                    } else {
                        nextDate = new Date(timelineDragOriginDate);
                        nextDate.setDate(nextDate.getDate() + timelineDragOffsetDays);
                    }
                } else {
                    nextDate = new Date(timelineDragOriginDate);
                    nextDate.setDate(nextDate.getDate() + timelineDragOffsetDays);
                }
                setTimelineOverrides((prev) => ({
                    ...prev,
                    [task.id]: {
                        date: nextDate.toISOString(),
                        isPoint: timelineDragIsPoint,
                        durationDays: timelineDragIsPoint ? undefined : nextDuration,
                    },
                }));
                const previousDueDate = task.dueDate || null;
                const nextDueDate = nextDate.toISOString();
                updateTaskDueDateLocal(task.tenantId, task.id, nextDueDate);
                requestAnimationFrame(() => {
                    setTimelineDragTaskId(null);
                    setTimelineDragOffsetDays(0);
                    setTimelineDragIsPoint(false);
                    setTimelineDragDurationDays(1);
                    setTimelineDragMode('move');
                    setTimelineDragOriginStart(null);
                    setTimelineDragOriginDuration(1);
                });
                try {
                    const res = await fetch(`${API_BASE}/commands/task/update-details`, {
                        method: 'POST',
                        headers: getApiHeaders(true, task.tenantId),
                        body: JSON.stringify({
                            taskId: task.id,
                            title: task.title,
                            description: task.description,
                            dueDate: nextDueDate,
                        }),
                    });
                    if (!res.ok) {
                        let message = 'Failed to update task';
                        try {
                            const err = await res.json();
                            message = err?.error || message;
                        } catch {
                            // ignore
                        }
                        throw new Error(message);
                    }
                } catch (e: any) {
                    updateTaskDueDateLocal(task.tenantId, task.id, previousDueDate);
                    alert(e.message || 'Failed to update task');
                }
            } else {
                setTimelineDragTaskId(null);
                setTimelineDragOffsetDays(0);
                setTimelineDragIsPoint(false);
                setTimelineDragDurationDays(1);
                setTimelineDragMode('move');
                setTimelineDragOriginStart(null);
                setTimelineDragOriginDuration(1);
            }
        };
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp, { once: true });
        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
        };
    }, [
        timelineDragTaskId,
        timelineDragOriginDate,
        timelineDragOriginX,
        timelineDragOriginScroll,
        timelineDragOffsetDays,
        timelineDragIsPoint,
        timelineDragDurationDays,
        timelineDragMode,
        timelineDragOriginStart,
        timelineDragOriginDuration,
        taskById,
    ]);

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
            if (editTaskScopeId !== editTaskScopeOriginal) {
                updateScopeWindows((prev) => {
                    let next = prev;
                    if (editTaskScopeOriginal) {
                        next = next.map((window) =>
                            window.id === editTaskScopeOriginal
                                ? { ...window, taskIds: window.taskIds.filter((id) => id !== editingTaskId) }
                                : window
                        );
                    } else {
                        next = next.map((window) =>
                            window.taskIds.includes(editingTaskId)
                                ? { ...window, taskIds: window.taskIds.filter((id) => id !== editingTaskId) }
                                : window
                        );
                    }
                    if (editTaskScopeId) {
                        next = next.map((window) =>
                            window.id === editTaskScopeId
                                ? {
                                    ...window,
                                    taskIds: window.taskIds.includes(editingTaskId)
                                        ? window.taskIds
                                        : window.taskIds.concat(editingTaskId)
                                }
                                : window
                        );
                    }
                    return next;
                });
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

    const finalizeDrag = () => {
        setDraggingTaskId(null);
        lastDragTargetRef.current = null;
        scopeDragTargetRef.current = null;
        setScopeDropTargetId(null);
        setTimeout(() => setIsDragging(false), 200);
    };

    const onDragEnd = (e: React.DragEvent) => {
        document.querySelectorAll('.task-card.drag-over-card').forEach((el) => {
            el.classList.remove('drag-over-card');
        });
        document.querySelectorAll('.kanban-column.drag-over').forEach((el) => {
            el.classList.remove('drag-over');
        });
        finalizeDrag();
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
            finalizeDrag();
            return;
        }

        setTaskOrderByColumn((prev) => {
            const next = { ...prev };
            const list = (next[key] || []).filter((id) => id !== taskId);
            next[key] = list.concat(taskId);
            persistOrder(activeTenantId, activeBoardId, next);
            return next;
        });
        finalizeDrag();
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
        finalizeDrag();
    };

    if (!session) {
        return (
            <div className="auth-screen">
                <div className="auth-card">
                    <div className="auth-header">
                        <h1>Kanbax</h1>
                        <p>Sign in to manage your tasks, huddles, and work.</p>
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
        return <div style={{ padding: '2rem' }}>SQOPUS wird geladen ...</div>;
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
                            placeholder="Search tasks, huddles..."
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
                                    <div className="search-title">Task columns</div>
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
                    <div className="topbar-personal">
                        <div className="topbar-greeting">
                            <span className="topbar-greeting-title">{greetingLabel}</span>
                            <div className="topbar-greeting-meta">
                                <div className={`focus-dropdown${isFocusDropdownOpen ? ' open' : ''}`} ref={focusDropdownRef}>
                                    <button
                                        type="button"
                                        className="focus-dropdown-button"
                                        onClick={() => {
                                            setIsFocusDropdownOpen((prev) => !prev);
                                            setIsQuickPinsOpen(false);
                                            setIsNotificationsOpen(false);
                                            setIsUserMenuOpen(false);
                                        }}
                                        aria-expanded={isFocusDropdownOpen}
                                        aria-haspopup="menu"
                                    >
                                        Heute fällig: {focusCount}
                                    </button>
                                    {isFocusDropdownOpen && (
                                        <div className="quick-pins-panel focus-panel header-dropdown-panel" role="menu">
                                            {focusTasksToday.length === 0 ? (
                                                <div className="quick-pin-empty">
                                                    <span className="quick-pin-empty-icon" aria-hidden="true">
                                                        <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6">
                                                            <path d="M4 7h16" />
                                                            <path d="M6 7v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7" />
                                                            <path d="M9 4h6" />
                                                            <path d="M9 11h6" />
                                                            <path d="M9 15h4" />
                                                        </svg>
                                                    </span>
                                                    <span>Keine Tasks fällig</span>
                                                </div>
                                            ) : (
                                                focusTasksToday.map((task) => (
                                                    <button
                                                        key={task.id}
                                                        type="button"
                                                        className="quick-pin quick-pin-panel-item"
                                                        onClick={() => {
                                                            setView('kanban');
                                                            setActiveBoardId(task.boardId || activeBoardId || 'default-board');
                                                            setPendingTaskOpen({ taskId: task.id, tenantId: task.tenantId || activeTenantId || '' });
                                                            setIsFocusDropdownOpen(false);
                                                        }}
                                                    >
                                                        <span className="quick-pin-dot task" aria-hidden="true" />
                                                        <span className="quick-pin-label">{task.title}</span>
                                                        <span className="quick-pin-meta">{getBoardLabel(task.boardId)}</span>
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="topbar-actions">
                        {quickPinItems.length > 0 && (
                            <div
                                className={`quick-pins quick-pins-icon${isQuickPinsOpen ? ' open' : ''}`}
                                ref={quickPinsDropdownRef}
                            >
                                <button
                                    type="button"
                                    className="notif-button quick-pins-icon-button"
                                    onClick={() => {
                                        setIsQuickPinsOpen((prev) => !prev);
                                        setIsFocusDropdownOpen(false);
                                        setIsNotificationsOpen(false);
                                        setIsUserMenuOpen(false);
                                    }}
                                    aria-expanded={isQuickPinsOpen}
                                    aria-haspopup="menu"
                                    title="Favoriten"
                                    aria-label="Favoriten öffnen"
                                >
                                    <span className="quick-pins-icon-star">★</span>
                                    {quickPinItems.length > 0 && <span className="notif-badge">{quickPinItems.length}</span>}
                                </button>
                                {isQuickPinsOpen && (
                                    <div className="quick-pins-panel header-dropdown-panel" role="menu">
                                        {quickPinItems.map((pin) => (
                                            <button
                                                key={pin.id}
                                                type="button"
                                                className="quick-pin quick-pin-panel-item"
                                                onClick={() => {
                                                    const task = allTasks.find((item) => item.id === pin.id);
                                                    if (!task) return;
                                                    setView('kanban');
                                                    setActiveBoardId(task.boardId || activeBoardId || 'default-board');
                                                    setPendingTaskOpen({ taskId: task.id, tenantId: task.tenantId || activeTenantId || '' });
                                                    setIsQuickPinsOpen(false);
                                                }}
                                            >
                                                <span className="quick-pin-dot task" aria-hidden="true" />
                                                <span className="quick-pin-label">{pin.label}</span>
                                                {pin.sublabel && <span className="quick-pin-meta">{pin.sublabel}</span>}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="notif-dropdown">
                            <button
                                className="notif-button"
                                onClick={() => {
                                    setIsNotificationsOpen((prev) => !prev);
                                    setIsQuickPinsOpen(false);
                                    setIsFocusDropdownOpen(false);
                                    setIsUserMenuOpen(false);
                                }}
                                aria-label="Notifications"
                            >
                                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
                                    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 7 3 7H3s3 0 3-7" />
                                    <path d="M10 21a2 2 0 0 0 4 0" />
                                </svg>
                                {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
                            </button>
                            {isNotificationsOpen && (
                                <div className="notif-panel header-dropdown-panel">
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
                        </div>
                        <div className="user-menu">
                            <button
                                className="user-menu-button"
                                onClick={() => {
                                    setIsUserMenuOpen((prev) => !prev);
                                    setIsNotificationsOpen(false);
                                    setIsQuickPinsOpen(false);
                                    setIsFocusDropdownOpen(false);
                                }}
                                aria-label="User menu"
                            >
                                {currentUserAvatar ? (
                                    <img src={currentUserAvatar} alt="User avatar" />
                                ) : (
                                    <span>{getInitials(currentUserLabel)}</span>
                                )}
                            </button>
                            {isUserMenuOpen && (
                                <div className="user-menu-dropdown header-dropdown-panel">
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
                                        Home
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
                                        Scope
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
                                <button
                                    className="sidebar-huddle-item sidebar-huddle-settings"
                                    onClick={() => {
                                        setIsTeamModalOpen(true);
                                        setIsHuddleMenuOpen(false);
                                    }}
                                >
                                    <span className="sidebar-huddle-name">Huddle settings</span>
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="sidebar-team">
                        <div className="sidebar-nav">
                            <button
                                className={`sidebar-nav-item ${view === 'dashboard' ? 'active' : ''}`}
                                onClick={() => setView('dashboard')}
                                data-tooltip="Home"
                            >
                                <span className="sidebar-nav-icon" aria-hidden="true">
                                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6">
                                        <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
                                        <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
                                        <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
                                        <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
                                    </svg>
                                </span>
                                <span className="sidebar-nav-label">Home</span>
                            </button>
                            <button
                                className={`sidebar-nav-item ${view === 'inbox' ? 'active' : ''}`}
                                onClick={() => setView('inbox')}
                                data-tooltip="Inbox"
                            >
                                <span className="sidebar-nav-icon" aria-hidden="true">
                                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6">
                                        <path d="M4 4h16v12H4z" />
                                        <path d="M4 16h6l2 3h4l2-3h6" />
                                    </svg>
                                </span>
                                <span className="sidebar-nav-label">Inbox</span>
                            </button>
                            <button
                                className={`sidebar-nav-item ${view === 'scope' ? 'active' : ''}`}
                                onClick={handleScopeNavClick}
                                data-tooltip="Scope"
                            >
                                <span className="sidebar-nav-icon" aria-hidden="true">
                                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6">
                                        <circle cx="12" cy="12" r="7.5" />
                                        <circle cx="12" cy="12" r="2.5" />
                                        <path d="M12 4v3" />
                                        <path d="M12 17v3" />
                                        <path d="M4 12h3" />
                                        <path d="M17 12h3" />
                                    </svg>
                                </span>
                                <span className="sidebar-nav-label">Scope</span>
                            </button>
                            <button
                                className={`sidebar-nav-item ${view === 'initiatives' ? 'active' : ''}`}
                                onClick={handleInitiativesNavClick}
                                data-tooltip="Initiatives"
                            >
                                <span className="sidebar-nav-icon" aria-hidden="true">
                                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6">
                                        <path d="M4 16l6-6 4 4 6-6" />
                                        <path d="M4 20h16" />
                                    </svg>
                                </span>
                                <span className="sidebar-nav-label">Initiatives</span>
                            </button>
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

            <div className="content-shell">
                <div className="page-heading-wrap">
                    <div className="page-breadcrumbs-row">
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
                                </span>
                            ))}
                        </div>
                        {(view === 'kanban' || view === 'table' || view === 'timeline' || view === 'scope' || view === 'initiatives') && (
                            <div className="page-breadcrumb-actions">
                                {(view === 'kanban' || view === 'table') && (
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
                                                    + Taskliste erstellen
                                                </button>
                                                {sidebarBoardItems.map((boardItem) => (
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
                                            </div>
                                        )}
                                    </span>
                                )}
                                {view === 'initiatives' && (
                                    <span className="board-switch-inline">
                                        <button
                                            type="button"
                                            className="board-switch-trigger-icon"
                                            onClick={() => setInitiativeMenuOpen((prev) => !prev)}
                                        >
                                            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2">
                                                <path d="M6 9l6 6 6-6" />
                                            </svg>
                                        </button>
                                        {initiativeMenuOpen && (
                                            <div className="board-switch-menu">
                                                <button
                                                    type="button"
                                                    className={`board-switch-item ${initiativeScreen === 'list' ? 'active' : ''}`}
                                                    onClick={() => {
                                                        setInitiativeMenuOpen(false);
                                                        setInitiativeScreen('list');
                                                        setInitiativeRouteId(null);
                                                        updateInitiativeUrl(null, 'replace');
                                                    }}
                                                >
                                                    Initiative list
                                                </button>
                                                {initiatives.length === 0 ? (
                                                    <div className="board-switch-empty">No initiatives yet.</div>
                                                ) : (
                                                    initiatives.map((initiative) => (
                                                        <button
                                                            key={initiative.id}
                                                            type="button"
                                                            className={`board-switch-item ${initiative.id === activeInitiativeId ? 'active' : ''}`}
                                                            onClick={() => {
                                                                setInitiativeMenuOpen(false);
                                                                openInitiativeDetail(initiative.id);
                                                            }}
                                                        >
                                                            {initiative.name}
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </span>
                                )}
                                {view === 'scope' && (
                                    <span className="board-switch-inline">
                                        <button
                                            type="button"
                                            className="board-switch-trigger-icon"
                                            onClick={() => setScopeMenuOpen((prev) => !prev)}
                                        >
                                            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2">
                                                <path d="M6 9l6 6 6-6" />
                                            </svg>
                                        </button>
                                        {scopeMenuOpen && (
                                            <div className="board-switch-menu">
                                                <button
                                                    type="button"
                                                    className={`board-switch-item ${scopeScreen === 'list' ? 'active' : ''}`}
                                                    onClick={() => {
                                                        setScopeMenuOpen(false);
                                                        setScopeScreen('list');
                                                        setScopeRouteId(null);
                                                        updateScopeUrl(null, 'replace');
                                                    }}
                                                >
                                                    Scope list
                                                </button>
                                                {scopeWindows.length === 0 ? (
                                                    <div className="board-switch-empty">No scope windows yet.</div>
                                                ) : (
                                                    scopeWindows.map((scopeWindow) => (
                                                        <button
                                                            key={scopeWindow.id}
                                                            type="button"
                                                            className={`board-switch-item ${scopeWindow.id === activeScopeId ? 'active' : ''}`}
                                                            onClick={() => {
                                                                setScopeMenuOpen(false);
                                                                openScopeDetail(scopeWindow.id);
                                                            }}
                                                        >
                                                            {scopeWindow.name}
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                    <div
                        className={`page-heading${view === 'kanban' || view === 'table' || view === 'dashboard' || view === 'initiatives' || view === 'inbox' || view === 'timeline' || view === 'scope' ? ' page-heading-style' : ''}`}
                    >
                        {!(view === 'okr' && okrScreen === 'objective') && (
                        <div className="page-heading-row">
                            <div className="page-heading-title">
                                <h1>
                                    {view === 'settings'
                                        ? 'Settings'
                                        : view === 'okr'
                                            ? 'Goals'
                                        : view === 'dashboard'
                                            ? 'Home'
                                        : view === 'calendar'
                                            ? 'Calendar'
                                            : view === 'inbox'
                                                ? 'Inbox'
                                        : view === 'initiatives'
                                            ? (initiativeScreen === 'detail' && activeInitiative ? activeInitiative.name : 'Initiatives')
                                        : view === 'scope'
                                            ? (scopeScreen === 'detail' && activeScopeWindow ? activeScopeWindow.name : 'Scope')
                                            : (activeBoard?.name || activeHuddleName || 'Work')}
                                    {view === 'scope' && (
                                        <button
                                            type="button"
                                            className="icon-action scope-help"
                                            data-tooltip="Ein Scope Window ist ein zeitlicher Rahmen, in dem bestimmte Tasks erledigt werden sollen."
                                            aria-label="Was ist ein Scope Window?"
                                        >
                                            <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
                                                <circle cx="12" cy="12" r="9" />
                                                <path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2 2-2 4" />
                                                <path d="M12 17h.01" />
                                            </svg>
                                        </button>
                                    )}
                                </h1>
                                {view === 'scope' && scopeScreen === 'detail' && activeScopeWindow && (
                                    <div className="page-heading-meta scope-meta">
                                        <div className="scope-meta-item">
                                            <span className="scope-meta-label">Zeitraum</span>
                                            <span className="scope-meta-value">{getScopeDateLabel(activeScopeWindow)}</span>
                                        </div>
                                        <div className="scope-meta-item">
                                            <span className="scope-meta-label">Sichtb.</span>
                                            <span className="scope-meta-value">
                                                {activeScopeWindow.visibility === 'personal' ? 'Personal' : 'Shared'}
                                            </span>
                                        </div>
                                        <div className="scope-meta-item">
                                            <span className="scope-meta-label">Members</span>
                                            <span className="scope-meta-value">{activeScopeWindow.members?.length || 0}</span>
                                        </div>
                                        <div className="scope-meta-item">
                                            <span className="scope-meta-label">Rolle</span>
                                            <span className="scope-meta-value">{activeScopeWindow.role || 'VIEWER'}</span>
                                        </div>
                                        {activeScopeWindow.createdBy && (
                                            <div className="scope-meta-item">
                                                <span className="scope-meta-label">Owner</span>
                                                <span className="scope-meta-value">
                                                    {getMemberInfo(activeTenantId, activeScopeWindow.createdBy).label}
                                                </span>
                                            </div>
                                        )}
                                        {activeScopeWindow.completionStatus && (
                                            <div className="scope-meta-item">
                                                <span className="scope-meta-label">Abschluss</span>
                                                <span className="scope-meta-value">
                                                    {activeScopeWindow.completionStatus === 'YES'
                                                        ? 'Ja'
                                                        : activeScopeWindow.completionStatus === 'PARTIAL'
                                                            ? 'Teilweise'
                                                            : 'Nein'}
                                                </span>
                                            </div>
                                        )}
                                        {activeScopeWindow.completedAt && (
                                            <div className="scope-meta-item">
                                                <span className="scope-meta-label">Abgeschlossen am</span>
                                                <span className="scope-meta-value">
                                                    {new Date(activeScopeWindow.completedAt).toLocaleDateString()}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {view === 'initiatives' && initiativeScreen === 'detail' && activeInitiative && (
                                    <div className="page-heading-meta initiative-meta">
                                        <span className="dashboard-badge">
                                            {activeInitiative.status === 'ACTIVE' ? 'Active' : 'Closed'}
                                        </span>
                                        <span className="page-heading-dot">·</span>
                                        <span>
                                            Owner:{' '}
                                            {activeInitiative.ownerId
                                                ? getMemberLabel(activeTenantId, activeInitiative.ownerId)
                                                : 'Unassigned'}
                                        </span>
                                        {activeInitiative.closedAt && (
                                            <span className="page-heading-dot">·</span>
                                        )}
                                        {activeInitiative.closedAt && (
                                            <span>
                                                Closed {new Date(activeInitiative.closedAt).toLocaleDateString()}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                            {(view === 'dashboard' || view === 'kanban' || view === 'table' || view === 'timeline' || (view === 'scope' && scopeScreen === 'detail' && activeScopeWindow) || (view === 'scope' && scopeScreen === 'list')) && (
                                <div className="page-heading-actions">
                                    {view === 'dashboard' && (
                                        <div className="page-heading-icons">
                                            <button
                                                type="button"
                                                className="icon-action create"
                                                onClick={() => {
                                                    setView('inbox');
                                                    setInboxCaptureOpen(true);
                                                }}
                                                data-tooltip="Inbox Item"
                                                aria-label="Inbox Item"
                                            >
                                                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6">
                                                    <path d="M4 4h16v12H4z" />
                                                    <path d="M4 16h6l2 3h4l2-3h6" />
                                                </svg>
                                            </button>
                                            <button
                                                type="button"
                                                className="icon-action create"
                                                onClick={openCreateTask}
                                                data-tooltip="Task erstellen"
                                                aria-label="Task erstellen"
                                            >
                                                <svg viewBox="0 0 24 24" fill="none" strokeWidth="2">
                                                    <path d="M12 5v14" />
                                                    <path d="M5 12h14" />
                                                </svg>
                                            </button>
                                            <button
                                                type="button"
                                                className="icon-action create"
                                                onClick={() => {
                                                    setView('scope');
                                                    setScopeScreen('list');
                                                    setIsScopeCreateOpen(true);
                                                }}
                                                data-tooltip="Scope erstellen"
                                                aria-label="Scope erstellen"
                                            >
                                                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6">
                                                    <circle cx="12" cy="12" r="7.5" />
                                                    <circle cx="12" cy="12" r="2.5" />
                                                    <path d="M12 4v3" />
                                                    <path d="M12 17v3" />
                                                    <path d="M4 12h3" />
                                                    <path d="M17 12h3" />
                                                </svg>
                                            </button>
                                            <button
                                                type="button"
                                                className="icon-action create"
                                                onClick={() => {
                                                    setView('initiatives');
                                                    setInitiativeScreen('list');
                                                    setIsInitiativeCreateOpen(true);
                                                }}
                                                data-tooltip="Initiative"
                                                aria-label="Initiative"
                                            >
                                                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6">
                                                    <path d="M4 16l6-6 4 4 6-6" />
                                                    <path d="M4 20h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    )}
                                    {(view === 'kanban' || view === 'table' || view === 'timeline') && (
                                        <>
                                            <button
                                                type="button"
                                                className="icon-action scope-toggle"
                                                onClick={() => setShowScopeDropRow((prev) => !prev)}
                                                data-tooltip="Tasks zu Scope zuteilen"
                                                aria-label="Tasks zu Scope zuteilen"
                                                aria-pressed={showScopeDropRow}
                                            >
                                                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
                                                    <circle cx="12" cy="12" r="8" />
                                                    <circle cx="12" cy="12" r="3" />
                                                    <path d="M12 2v3" />
                                                    <path d="M12 19v3" />
                                                    <path d="M2 12h3" />
                                                    <path d="M19 12h3" />
                                                </svg>
                                            </button>
                                            {isActiveHuddleOwner && !isArchivedBoard && !isSpecialBoard && (
                                                <button
                                                    className="icon-action settings"
                                                    onClick={() => setIsBoardSettingsOpen(true)}
                                                    data-tooltip="Einstellungen zu Tasks"
                                                    aria-label="Einstellungen zu Tasks"
                                                >
                                                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
                                                        <circle cx="12" cy="12" r="3.5" />
                                                        <path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.3.7a7 7 0 0 0-1.6-1l-.3-2.4H9.3l-.3 2.4a7 7 0 0 0-1.6 1l-2.3-.7-2 3.5 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.5 2.3-.7a7 7 0 0 0 1.6 1l.3 2.4h5.4l.3-2.4a7 7 0 0 0 1.6-1l2.3.7 2-3.5-2-1.5a7 7 0 0 0 .1-1z" />
                                                    </svg>
                                                </button>
                                            )}
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
                                        </>
                                    )}
                                    {view === 'scope' && scopeScreen === 'detail' && activeScopeWindow && (
                                        <>
                                            <button
                                                className="icon-action create"
                                                disabled={!canEditActiveScopeItems || isActiveScopeCompleted}
                                                onClick={openScopeTaskModal}
                                                data-tooltip="Task im Scope erstellen"
                                                aria-label="Task im Scope erstellen"
                                            >
                                                <svg viewBox="0 0 24 24" fill="none" strokeWidth="2">
                                                    <path d="M12 5v14" />
                                                    <path d="M5 12h14" />
                                                </svg>
                                            </button>
                                            {canManageActiveScope && (
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
                                            )}
                                            {canManageActiveScope && (!currentWeeklyScopeId || activeScopeWindow.id !== currentWeeklyScopeId) && (
                                                <button
                                                    className="icon-action"
                                                    onClick={() => setIsScopeCloseOpen(true)}
                                                    data-tooltip="Scope abschließen"
                                                    aria-label="Scope abschließen"
                                                >
                                                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
                                                        <path d="M5 12l5 5 9-9" />
                                                    </svg>
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}
                            {view === 'initiatives' && initiativeScreen === 'detail' && activeInitiative && (
                                <div className="page-heading-actions">
                                    <button
                                        type="button"
                                        className="icon-action"
                                        onClick={() => {
                                            setInitiativeDraft({
                                                name: activeInitiative.name,
                                                goal: activeInitiative.goal || '',
                                                description: activeInitiative.description || '',
                                                ownerId: activeInitiative.ownerId || '',
                                            });
                                            setInitiativeEditId(activeInitiative.id);
                                            setIsInitiativeCreateOpen(true);
                                        }}
                                        data-tooltip="Initiative bearbeiten"
                                        aria-label="Initiative bearbeiten"
                                    >
                                        <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
                                            <path d="M12 20h9" />
                                            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                                        </svg>
                                    </button>
                                </div>
                            )}
                        </div>
                        )}
                    </div>
                </div>
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

                {view === 'inbox' && (
                    <div className="filter-bar inbox-filter-bar">
                        <div
                            className="view-switch inbox-view-switch"
                            role="tablist"
                            aria-label="Inbox view switcher"
                            style={{
                                ['--active-index' as any]: ['eingang', 'spaeter', 'bearbeitet', 'archiv'].indexOf(inboxView),
                                ['--segment-count' as any]: 4
                            }}
                        >
                            {[
                                { key: 'eingang', label: 'Eingang', count: inboxCounts.eingang },
                                { key: 'spaeter', label: 'Später', count: inboxCounts.spaeter },
                                { key: 'bearbeitet', label: 'Bearbeitet' },
                                { key: 'archiv', label: 'Archiviert' }
                            ].map((tab) => (
                                <button
                                    key={tab.key}
                                    type="button"
                                    className={`view-pill ${inboxView === tab.key ? 'active' : ''}`}
                                    onClick={() => setInboxView(tab.key as any)}
                                    role="tab"
                                    aria-selected={inboxView === tab.key}
                                >
                                    <span>{tab.label}</span>
                                    {'count' in tab && typeof tab.count === 'number' && tab.count > 0 && (
                                        <span className="view-pill-badge" aria-hidden="true">
                                            {tab.count}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
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
                                    <section className="settings-card ui-card">
                                        <div className="settings-card-header ui-card-header">
                                            <div className="settings-title">Profile</div>
                                        </div>
                                        <div className="settings-card-body ui-card-body">
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
                                        </div>
                                    </section>

                                    <section className="settings-card ui-card">
                                        <div className="settings-card-header ui-card-header">
                                            <div className="settings-title">Localization</div>
                                        </div>
                                        <div className="settings-card-body ui-card-body">
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
                                        </div>
                                    </section>

                                    <section className="settings-card ui-card">
                                        <div className="settings-card-header ui-card-header">
                                            <div className="settings-title">Defaults</div>
                                        </div>
                                        <div className="settings-card-body ui-card-body">
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
                                                    <option value="IN_PROGRESS">Doing</option>
                                                    <option value="DONE">Done</option>
                                                </select>
                                            </label>
                                        </div>
                                    </section>

                                    <section className="settings-card ui-card">
                                        <div className="settings-card-header ui-card-header">
                                            <div className="settings-title">Notifications</div>
                                        </div>
                                        <div className="settings-card-body ui-card-body">
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
                                        </div>
                                    </section>

                                    <section className="settings-card ui-card">
                                        <div className="settings-card-header ui-card-header">
                                            <div className="settings-title">Working hours</div>
                                        </div>
                                        <div className="settings-card-body ui-card-body">
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
                                        </div>
                                    </section>

                                    <section className="settings-card ui-card">
                                        <div className="settings-card-header ui-card-header">
                                            <div className="settings-title">Reminders</div>
                                        </div>
                                        <div className="settings-card-body ui-card-body">
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
                                        </div>
                                    </section>


                                    <section className="settings-card ui-card">
                                        <div className="settings-card-header ui-card-header">
                                            <div className="settings-title">Huddles</div>
                                        </div>
                                        <div className="settings-card-body ui-card-body">
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
                                        </div>
                                    </section>

                                    <section className="settings-card ui-card">
                                        <div className="settings-card-header ui-card-header">
                                            <div className="settings-title">Security & Sessions</div>
                                        </div>
                                        <div className="settings-card-body ui-card-body">
                                            <button className="btn btn-secondary btn-compact" onClick={handlePasswordReset}>
                                                Send password reset email
                                            </button>
                                            <button className="btn btn-ghost btn-compact" onClick={handleSignOut}>
                                                Sign out
                                            </button>
                                        </div>
                                    </section>

                                    <section className="settings-card ui-card">
                                        <div className="settings-card-header ui-card-header">
                                            <div className="settings-title">Export</div>
                                        </div>
                                        <div className="settings-card-body ui-card-body">
                                            <div className="settings-actions">
                                                <button className="btn btn-secondary btn-compact" onClick={exportTasksJson}>
                                                    Export JSON
                                                </button>
                                                <button className="btn btn-secondary btn-compact" onClick={exportTasksCsv}>
                                                    Export CSV
                                                </button>
                                            </div>
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
                        <div className="okr-create ui-card">
                            <div className="okr-card-title ui-card-header">Create objective</div>
                            <div className="okr-card-body ui-card-body">
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
                                    <button className="btn btn-ghost btn-compact" onClick={loadOkrs}>
                                        Refresh
                                    </button>
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
                                </div>
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
                                            className="okr-card ui-card"
                                            onClick={() => navigateOkr(`/okr/objective/${objective.id}`)}
                                        >
                                            <div className="okr-header ui-card-header">
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
                                                <div className="okr-card-body ui-card-body">
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
                                            <div className="filter-bar">
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
                                            </div>
                                            {!okrActiveObjective.readOnly && (
                                                <button
                                                    className="icon-action create"
                                                    onClick={() => openKrComposer(okrActiveObjective.id)}
                                                    data-tooltip={`Neuen Key result hinzufügen`}
                                                    aria-label={`Neuen Key result hinzufügen`}
                                                >
                                                    <svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M12 5v14"></path><path d="M5 12h14"></path></svg>
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
                                                    <div key={kr.id} className="okr-kr-card ui-card">
                                                        <div className="okr-kr-card-header ui-card-header">
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
                                                        </div>
                                                        <div className="okr-kr-card-body ui-card-body">
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
                                <div className="okr-pulse-toolbar">
                                    <div className="filter-bar">
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
                                                <div className="member-select" data-member-dropdown="objective-owner">
                                                    <button
                                                        type="button"
                                                        className="member-select-trigger"
                                                        onClick={() =>
                                                            setOpenMemberDropdownId((prev) => (prev === 'objective-owner' ? null : 'objective-owner'))
                                                        }
                                                    >
                                                        {objectiveDraft.ownerId
                                                            ? getMemberLabel(activeTenantId, objectiveDraft.ownerId)
                                                            : 'Unassigned'}
                                                    </button>
                                                    {openMemberDropdownId === 'objective-owner' && (
                                                        <div className="member-select-dropdown">
                                                            <button
                                                                type="button"
                                                                className={`member-select-option${!objectiveDraft.ownerId ? ' active' : ''}`}
                                                                onClick={() => {
                                                                    setObjectiveDraft((prev) => ({ ...prev, ownerId: '' }));
                                                                    setOpenMemberDropdownId(null);
                                                                }}
                                                            >
                                                                Unassigned
                                                            </button>
                                                            {getMembersForTenant(activeTenantId).map((member) => (
                                                                <button
                                                                    key={member.userId}
                                                                    type="button"
                                                                    className={`member-select-option${objectiveDraft.ownerId === member.userId ? ' active' : ''}`}
                                                                    onClick={() => {
                                                                        setObjectiveDraft((prev) => ({ ...prev, ownerId: member.userId }));
                                                                        setOpenMemberDropdownId(null);
                                                                    }}
                                                                >
                                                                    {member.user?.name || member.user?.email || member.userId}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
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
                                    </div>
                                    <div className="panel-footer">
                                        <div className="panel-actions">
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
                <>
                    {activeTenantId && scopeScreen === 'detail' && activeScopeWindow && (
                        <div className="filter-bar">
                            <div
                                className="view-switch"
                                role="tablist"
                                aria-label="View switcher"
                                style={{
                                    ['--active-index' as any]:
                                        scopeDetailView === 'board' ? 1 : scopeDetailView === 'timeline' ? 2 : 0,
                                    ['--segment-count' as any]: 3,
                                }}
                            >
                                <button
                                    className={`view-pill ${scopeDetailView === 'list' ? 'active' : ''}`}
                                    onClick={() => setScopeDetailView('list')}
                                    role="tab"
                                    aria-selected={scopeDetailView === 'list'}
                                >
                                    List
                                </button>
                                <button
                                    className={`view-pill ${scopeDetailView === 'board' ? 'active' : ''}`}
                                    onClick={() => setScopeDetailView('board')}
                                    role="tab"
                                    aria-selected={scopeDetailView === 'board'}
                                >
                                    Board
                                </button>
                                <button
                                    className={`view-pill ${scopeDetailView === 'timeline' ? 'active' : ''}`}
                                    onClick={() => setScopeDetailView('timeline')}
                                    role="tab"
                                    aria-selected={scopeDetailView === 'timeline'}
                                >
                                    Timeline
                                </button>
                            </div>
                            <div className="filter-actions">
                                <div className="filter-quick">
                                    {[
                                        { key: 'MINE', label: 'My tasks' },
                                        { key: 'OVERDUE', label: 'Overdue' },
                                        { key: 'WEEK', label: 'This week' }
                                    ].map((item) => (
                                        <button
                                            key={item.key}
                                            type="button"
                                            className={`filter-quick-pill${quickFilter === item.key ? ' active' : ''}`}
                                            onClick={() => setQuickFilter((prev) => (prev === item.key ? 'ALL' : (item.key as any)))}
                                        >
                                            {item.label}
                                        </button>
                                    ))}
                                </div>
                                {scopeDetailView === 'timeline' && (
                                    <div className="filter-dropdown" ref={timelineRangeRef}>
                                        <button
                                            type="button"
                                            className="filter-select"
                                            onClick={() => setTimelineRangeOpen((prev) => !prev)}
                                            aria-haspopup="listbox"
                                            aria-expanded={timelineRangeOpen}
                                        >
                                            {timelineRange === 'auto' ? 'Auto range' : `${timelineRange} days`}
                                        </button>
                                        {timelineRangeOpen && (
                                            <div className="filter-options" role="listbox">
                                                {[
                                                    { value: 'auto', label: 'Auto range' },
                                                    { value: 14, label: '14 days' },
                                                    { value: 30, label: '30 days' },
                                                    { value: 60, label: '60 days' },
                                                    { value: 90, label: '90 days' },
                                                ].map((option) => (
                                                    <button
                                                        key={option.value}
                                                        type="button"
                                                        className={`filter-option ${timelineRange === option.value ? 'active' : ''}`}
                                                        onClick={() => {
                                                            setTimelineRange(option.value as any);
                                                            setTimelineRangeOpen(false);
                                                        }}
                                                        role="option"
                                                        aria-selected={timelineRange === option.value}
                                                    >
                                                        {option.label}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                                <div className="filter-dropdown" ref={scopePriorityFilterRef}>
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
                                {scopeDetailView === 'list' && (
                                    <div className="filter-dropdown" ref={scopeStatusFilterRef}>
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
                                                {['ALL', TaskStatus.BACKLOG, TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.DONE].map((value) => (
                                                    <button
                                                        key={value}
                                                        type="button"
                                                        className={`filter-option ${scopeFilterStatus === value ? 'active' : ''}`}
                                                        onClick={() => {
                                                            setScopeFilterStatus(value as any);
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
                                )}
                                <div className="filter-dropdown" ref={labelFilterRef}>
                                    <button
                                        type="button"
                                        className="filter-select"
                                        onClick={() => setLabelFilterOpen((prev) => !prev)}
                                        aria-haspopup="listbox"
                                        aria-expanded={labelFilterOpen}
                                    >
                                        {selectedLabelFilters.length > 0
                                            ? `Labels (${selectedLabelFilters.length})`
                                            : 'All labels'}
                                    </button>
                                    {labelFilterOpen && (
                                        <div className="filter-options filter-options-multi" role="listbox">
                                            {scopeLabelOptions.length === 0 && (
                                                <div className="filter-empty">No labels found</div>
                                            )}
                                            {scopeLabelOptions.map((label) => {
                                                const active = selectedLabelFilters.includes(label);
                                                return (
                                                    <button
                                                        key={label}
                                                        type="button"
                                                        className={`filter-option ${active ? 'active' : ''}`}
                                                        onClick={() => {
                                                            setSelectedLabelFilters((prev) =>
                                                                prev.includes(label)
                                                                    ? prev.filter((item) => item !== label)
                                                                    : prev.concat(label)
                                                            );
                                                        }}
                                                        role="option"
                                                        aria-selected={active}
                                                    >
                                                        <span>{label}</span>
                                                        {active && <span className="filter-option-check">✓</span>}
                                                    </button>
                                                );
                                            })}
                                            {selectedLabelFilters.length > 0 && (
                                                <button
                                                    type="button"
                                                    className="filter-option filter-option-clear"
                                                    onClick={() => setSelectedLabelFilters([])}
                                                >
                                                    Clear selection
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <label
                                    className={`filter-checkbox filter-favorites ${filterFavorites ? 'active' : ''}`}
                                    data-tooltip="Nur Favoriten"
                                    aria-label="Nur Favoriten"
                                >
                                    <input
                                        type="checkbox"
                                        checked={filterFavorites}
                                        onChange={(e) => setFilterFavorites(e.target.checked)}
                                    />
                                    <span className="filter-favorites-icon" aria-hidden="true">★</span>
                                </label>
                            </div>
                        </div>
                    )}
                    {activeTenantId && !(scopeScreen === 'detail' && activeScopeWindow) && (
                        <div className="filter-bar">
                            <div
                                className="view-switch"
                                role="tablist"
                                aria-label="Scope filter"
                                style={{
                                    ['--active-index' as any]:
                                        scopeTab === 'completed' ? 2 : scopeTab === 'review' ? 1 : 0,
                                    ['--segment-count' as any]: 3,
                                    alignSelf: 'flex-start'
                                }}
                            >
                                <button
                                    className={`view-pill ${scopeTab === 'current' ? 'active' : ''}`}
                                    onClick={() => setScopeTab('current')}
                                    role="tab"
                                    aria-selected={scopeTab === 'current'}
                                >
                                    Aktuell
                                </button>
                                <button
                                    className={`view-pill ${scopeTab === 'review' ? 'active' : ''}`}
                                    onClick={() => setScopeTab('review')}
                                    role="tab"
                                    aria-selected={scopeTab === 'review'}
                                >
                                    Review
                                </button>
                                <button
                                    className={`view-pill ${scopeTab === 'completed' ? 'active' : ''}`}
                                    onClick={() => setScopeTab('completed')}
                                    role="tab"
                                    aria-selected={scopeTab === 'completed'}
                                >
                                    Beendet
                                </button>
                            </div>
                        </div>
                    )}
                    <div className="dashboard-panel">
                        {!activeTenantId ? (
                            <div className="empty-state">Select a huddle to build a scope window.</div>
                        ) : scopeScreen === 'detail' && activeScopeWindow ? (
                            <>
                                {scopeDetailView === 'board' ? (
                                    <div className="kanban-board-wrap">
                                        <div className="kanban-board">
                                            {scopeBoardColumns.map((column) => (
                                                <div
                                                    key={column.status}
                                                    className="kanban-column"
                                                    onDragOver={handleScopeColumnDragOver}
                                                    onDragLeave={handleScopeColumnDragLeave}
                                                    onDrop={(event) => handleScopeColumnDrop(event, column.status)}
                                                >
                                                    <div className="column-header">
                                                                            <span>{getStatusLabel(column.status)}</span>
                                                        <span>{column.tasks.length}</span>
                                                    </div>
                                                    <div className="column-content">
                                                        {column.tasks.map((task) => {
                                                            const checklistDone = task.checklist.filter((item) => item.done).length;
                                                            const checklistTotal = task.checklist.length;
                                                            const isChecklistComplete = checklistTotal > 0 && checklistDone === checklistTotal;
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
                                                                <div
                                                                    key={task.id}
                                                                    className={`task-card${isDraggable ? ' task-card-draggable' : ''}${draggingTaskId === task.id ? ' dragging' : ''}${cardStatusClass}`}
                                                                    style={taskCardStyle}
                                                                    draggable={isDraggable && canEditActiveScopeItems}
                                                                    onDragStart={(e) => (isDraggable && canEditActiveScopeItems ? onDragStart(e, task.id) : e.preventDefault())}
                                                                    onDragEnd={onDragEnd}
                                                                    onDragOver={(e) => handleScopeCardDragOver(e, column.status, task.id)}
                                                                    onDragLeave={handleScopeCardDragLeave}
                                                                    onDrop={(e) => handleScopeCardDrop(e, column.status, task.id)}
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
                                                                            <span
                                                                                className={`badge badge-priority-${task.priority.toLowerCase()} tooltip-target`}
                                                                                data-tooltip={`Priority: ${task.priority}`}
                                                                            >
                                                                                {task.priority}
                                                                            </span>
                                                                        </div>
                                                                        <div className="task-card-header">
                                                                            <div className="task-title-row">
                                                                                {task.title}
                                                                            </div>
                                                                            <button
                                                                                type="button"
                                                                                className={`favorite-badge favorite-badge-button${task.isFavorite ? ' active' : ''}`}
                                                                                onClick={(event) => {
                                                                                    event.stopPropagation();
                                                                                    toggleFavorite(task);
                                                                                }}
                                                                                title={task.isFavorite ? 'Unfavorite' : 'Favorite'}
                                                                                aria-label={task.isFavorite ? 'Unfavorite task' : 'Favorite task'}
                                                                            >
                                                                                {task.isFavorite ? '★' : '☆'}
                                                                            </button>
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
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : scopeDetailView === 'timeline' ? (
                                    renderTimeline(scopeVisibleTasks, 'No tasks to show on timeline.')
                                ) : (
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
                                                {scopeVisibleTasks.map((task) => {
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
                                                                <td>{task.sourceIndicator || '—'}</td>
                                                                <td>
                                                                    <div className="table-actions">
                                                                        {task.sourceType === 'MANUAL' && !isActiveScopeCompleted && (
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
                                )}
                            </>
                        ) : (
                            <>
                            <div className="dashboard-card dashboard-list ui-card">
                            
                                                <div className="dashboard-card-title ui-card-header">
                                                    <div className="dashboard-card-title-row inbox-header-row">
                                                        <div className="inbox-header-left">
                                                            <span>Scope Windows</span>
                                                        </div>
                                                        <div className="inbox-header-actions">
                                                            <button
                                                                type="button"
                                                                className="btn btn-save btn-compact tooltip-target"
                                                                data-tooltip="Scope erstellen"
                                                aria-label="Scope erstellen"
                                                onClick={() => setIsScopeCreateOpen(true)}
                                            >
                                                <span className="btn-save-icon">
                                                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" stroke="currentColor">
                                                        <path d="M12 5v14M5 12h14" />
                                                    </svg>
                                                </span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div className="dashboard-card-content ui-card-body">
                                        <div className="inbox-layout scope-inbox-layout">
                                            <div className="inbox-sidebar scope-inbox-sidebar">
                                                {filteredScopeWindows.length === 0 ? (
                                                    <div className="scope-empty">Noch keine Scope Windows.</div>
                                                ) : (
                                                    filteredScopeWindows.map((scopeWindow) => (
                                                        <button
                                                            key={scopeWindow.id}
                                                            type="button"
                                                            className={`inbox-sidebar-item scope-sidebar-item${activeScopeId === scopeWindow.id ? ' active' : ''}`}
                                                            onClick={() => {
                                                            setActiveScopeId(scopeWindow.id);
                                                            setScopeScreen('list');
                                                            setScopeRouteId(null);
                                                            updateScopeUrl(null, 'replace');
                                                        }}
                                                    >
                                                            <div className="inbox-sidebar-body">
                                                                <div className="inbox-sidebar-title">
                                                                    {scopeWindow.name}
                                                                    {scopeWindow.id === currentWeeklyScopeId && (
                                                                        <span className="dashboard-badge dashboard-badge-week">
                                                                            Diese Woche
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="inbox-sidebar-meta">
                                                                    <div className="inbox-sidebar-meta-date">{getScopeDateLabel(scopeWindow)}</div>
                                                                    {scopeWindow.initiativeId && initiativeLookup.get(scopeWindow.initiativeId) && (
                                                                        <div className="inbox-sidebar-meta-date">
                                                                            Initiative: {initiativeLookup.get(scopeWindow.initiativeId)?.name}
                                                                        </div>
                                                                    )}
                                                                    <div className="inbox-sidebar-meta-date">{scopeWindow.taskIds.length} tasks</div>
                                                                </div>
                                                            </div>
                                                        </button>
                                                    ))
                                                )}
                                        </div>
                                        <div className="inbox-detail scope-detail">
                                            {!activeScopeWindow ? (
                                                <div className="scope-empty scope-empty-cta">
                                                    <div className="scope-empty-title">Scope auswählen</div>
                                                    <div className="scope-empty-text">Wähle links ein Scope Window aus.</div>
                                                </div>
                                            ) : (
                                                <div className="scope-preview-card ui-card">
                                                    <div className="ui-card-header">
                                                        <div>
                                                            <div className="scope-preview-title">{activeScopeWindow.name}</div>
                                                            <div className="scope-preview-meta">
                                                                {getScopeDateLabel(activeScopeWindow)} · {activeScopeWindow.taskIds.length} tasks
                                                            </div>
                                                            {activeScopeWindow.initiativeId
                                                                && initiativeLookup.get(activeScopeWindow.initiativeId)?.status === 'ACTIVE' && (
                                                                <div className="scope-preview-meta">
                                                                    <span className="dashboard-badge">
                                                                        Initiative: {initiativeLookup.get(activeScopeWindow.initiativeId)?.name}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <button
                                                            type="button"
                                                            className="icon-action scope-toggle inbox-action tooltip-target"
                                                            onClick={() => openScopeDetail(activeScopeWindow.id)}
                                                            data-tooltip="Zu den Scope-Details"
                                                            aria-label="Zu den Scope-Details"
                                                        >
                                                            <span className="inbox-action-icon" aria-hidden="true">
                                                                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
                                                                    <path d="M9 6l6 6-6 6" />
                                                                </svg>
                                                            </span>
                                                        </button>
                                                    </div>
                                                    <div className="ui-card-body scope-mini-board-wrapper">
                                                        <div className="scope-mini-board">
                                                            {(() => {
                                                                const scopedTasks = activeScopeWindow.taskIds
                                                                    .map((taskId) => scopeTaskById.get(taskId))
                                                                    .filter((task): task is TaskView => Boolean(task));
                                                                const backlogTasks = scopedTasks.filter((task) => task.status === TaskStatus.BACKLOG);
                                                                const todoTasks = scopedTasks.filter((task) => task.status === TaskStatus.TODO);
                                                                const doingTasks = scopedTasks.filter((task) => task.status === TaskStatus.IN_PROGRESS);
                                                                const doneTasks = scopedTasks.filter((task) => task.status === TaskStatus.DONE);
                                                                const todoList = [...backlogTasks, ...todoTasks];
                                                                const columns: Array<{
                                                                    key: string;
                                                                    label: string;
                                                                    tasks: TaskView[];
                                                                    status: TaskStatus;
                                                                }> = [
                                                                    { key: 'todo', label: 'ToDos', tasks: todoList, status: TaskStatus.TODO },
                                                                    { key: 'doing', label: 'Doing', tasks: doingTasks, status: TaskStatus.IN_PROGRESS },
                                                                    { key: 'done', label: 'Done', tasks: doneTasks, status: TaskStatus.DONE },
                                                                ];
                                                                return columns.map((column) => (
                                                                    <div key={column.key} className="scope-mini-column">
                                                                        <div className="scope-mini-column-title">{column.label}</div>
                                                                        <div
                                                                            className="scope-mini-column-list"
                                                                            onDragOver={handleScopeColumnDragOver}
                                                                            onDragLeave={handleScopeColumnDragLeave}
                                                                            onDrop={(event) => handleScopeColumnDrop(event, column.status)}
                                                                        >
                                                                            {column.tasks.length === 0 ? (
                                                                                <div className="scope-mini-empty">Keine Tasks</div>
                                                                            ) : (
                                                                                column.tasks.map((task) => (
                                                                                    <div
                                                                                        key={task.id}
                                                                                        className="scope-mini-card"
                                                                                        draggable
                                                                                        onDragStart={(event) => onDragStart(event, task.id)}
                                                                                        onDragEnd={onDragEnd}
                                                                                    >
                                                                                        <div className="scope-mini-card-title">{task.title}</div>
                                                                                        <div className="scope-mini-card-meta">
                                                                                            {task.priority}
                                                                                            {task.dueDate ? ` • ${new Date(task.dueDate).toLocaleDateString()}` : ''}
                                                                                        </div>
                                                                                    </div>
                                                                                ))
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                ));
                                                            })()}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            </>
                        )}
                    </div>
                </>
                ) : view === 'dashboard' ? (
                    <div className="dashboard-panel">
                        {!activeTenantId ? (
                            <div className="empty-state">Select a huddle to see Home.</div>
                        ) : (
                            <>
                                <div className="dashboard-sections dashboard-summary-grid">
                                <div className="dashboard-card dashboard-list ui-card">
                                    <div className="dashboard-card-title ui-card-header">Scope diese Woche</div>
                                    <div className="dashboard-card-content ui-card-body">
                                        {!currentWeeklyScope ? (
                                            <div className="dashboard-empty">Kein Weekly Scope vorhanden.</div>
                                        ) : (
                                            <>
                                                <button
                                                    type="button"
                                                    className="dashboard-item"
                                                    onClick={() => openScopeDetail(currentWeeklyScope.id)}
                                                >
                                                    <div className="dashboard-item-title">{currentWeeklyScope.name}</div>
                                                    <div className="dashboard-item-meta">
                                                        {getScopeDateLabel(currentWeeklyScope)} · {currentWeeklyScope.taskIds.length} tasks
                                                    </div>
                                                </button>
                                                <div className="dashboard-kpi-row">
                                                    <span>Offen</span>
                                                    <strong>{weeklyScopeStats?.open ?? 0}</strong>
                                                </div>
                                                <div className="dashboard-kpi-row">
                                                    <span>Erledigt</span>
                                                    <strong>{weeklyScopeStats?.done ?? 0}</strong>
                                                </div>
                                                <div className="dashboard-kpi-row">
                                                    <span>Completion</span>
                                                    <strong>{weeklyScopeStats?.completion ?? 0}%</strong>
                                                </div>
                                                <div className="dashboard-progress">
                                                    <span
                                                        className="dashboard-progress-fill"
                                                        style={{ width: `${weeklyScopeStats?.completion ?? 0}%` }}
                                                    />
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="dashboard-card dashboard-list ui-card">
                                    {(() => {
                                        const todoCount =
                                            (dashboardSummary.statusCounts[TaskStatus.TODO] || 0) +
                                            (dashboardSummary.statusCounts[TaskStatus.BACKLOG] || 0);
                                        const doingCount = dashboardSummary.statusCounts[TaskStatus.IN_PROGRESS] || 0;
                                        const doneCount = dashboardSummary.statusCounts[TaskStatus.DONE] || 0;
                                        const total = Math.max(1, todoCount + doingCount + doneCount);
                                        const r = 46;
                                        const c = 2 * Math.PI * r;
                                        const todoLen = (todoCount / total) * c;
                                        const doingLen = (doingCount / total) * c;
                                        const doneLen = (doneCount / total) * c;
                                        const todoOffset = 0;
                                        const doingOffset = todoOffset - todoLen;
                                        const doneOffset = doingOffset - doingLen;
                                        return (
                                            <>
                                                <div className="dashboard-card-title ui-card-header">Task status</div>
                                                <div className="dashboard-card-content ui-card-body">
                                                    <div className="dashboard-donut">
                                                        <svg viewBox="0 0 120 120" role="img" aria-label="Task status donut">
                                                            <circle className="dashboard-donut-track" cx="60" cy="60" r={r} />
                                                            <circle
                                                                className="dashboard-donut-slice slice-todo"
                                                                cx="60"
                                                                cy="60"
                                                                r={r}
                                                                strokeDasharray={`${todoLen} ${c - todoLen}`}
                                                                strokeDashoffset={todoOffset}
                                                            />
                                                            <circle
                                                                className="dashboard-donut-slice slice-doing"
                                                                cx="60"
                                                                cy="60"
                                                                r={r}
                                                                strokeDasharray={`${doingLen} ${c - doingLen}`}
                                                                strokeDashoffset={doingOffset}
                                                            />
                                                            <circle
                                                                className="dashboard-donut-slice slice-done"
                                                                cx="60"
                                                                cy="60"
                                                                r={r}
                                                                strokeDasharray={`${doneLen} ${c - doneLen}`}
                                                                strokeDashoffset={doneOffset}
                                                            />
                                                            <text x="60" y="56" textAnchor="middle" className="dashboard-donut-value">
                                                                {todoCount + doingCount + doneCount}
                                                            </text>
                                                            <text x="60" y="74" textAnchor="middle" className="dashboard-donut-label">
                                                                tasks
                                                            </text>
                                                        </svg>
                                                    </div>
                                                    <div className="dashboard-donut-legend">
                                                        <div><span className="dot todo" />ToDo {todoCount}</div>
                                                        <div><span className="dot doing" />Doing {doingCount}</div>
                                                        <div><span className="dot done" />Done {doneCount}</div>
                                                    </div>
                                                </div>
                                            </>
                                        );
                                    })()}
                                </div>
                                </div>
                                <div className="dashboard-visuals dashboard-visuals-interactive">
                                <div className="dashboard-line-card">
                                    <div className="dashboard-line-header">
                                        <div>
                                            <div className="dashboard-line-title">Activity / Progress</div>
                                            <div className="dashboard-line-value">
                                                {lineChartTotals.activity}
                                                <span>events · 14d</span>
                                            </div>
                                        </div>
                                        <div className="dashboard-line-chip">Live trend</div>
                                    </div>
                                    {renderLineChart(
                                        [
                                            { key: 'activity', label: 'Activity', series: lineChartSeries.activity, className: 'line-activity' },
                                            { key: 'open', label: 'Open', series: lineChartSeries.open, className: 'line-open' },
                                            { key: 'done', label: 'Done', series: lineChartSeries.done, className: 'line-done' },
                                        ],
                                        {
                                            labels: lineChartLabels,
                                            hoverIndex: lineHoverIndex,
                                            onHover: setLineHoverIndex,
                                            width: 300,
                                            height: 120,
                                            padding: 16,
                                        }
                                    )}
                                    <div className="dashboard-line-legend">
                                        <span className="line-key line-activity">Activity</span>
                                        <span className="line-key line-open">Open</span>
                                        <span className="line-key line-done">Done</span>
                                    </div>
                                    <div className="dashboard-line-axis">
                                        <span>{lineChartLabels[0] ?? ''}</span>
                                        <span>{lineChartLabels[lineChartLabels.length - 1] ?? ''}</span>
                                    </div>
                                </div>
                            </div>
                            </>
                        )}
                    </div>
                ) : view === 'inbox' ? (
                    <div className="dashboard-panel">
                        {!activeTenantId ? (
                            <div className="empty-state">Select a huddle to see Inbox.</div>
                        ) : (
                            <div className="dashboard-card dashboard-list ui-card">
                                <div className="dashboard-card-title ui-card-header">
                                    <div className="dashboard-card-title-row inbox-header-row">
                                        {(() => {
                                            const currentHeading = inboxViewHeadings[inboxView];
                                            return (
                                                <div className="inbox-header-left">
                                                    <span>{currentHeading.label}</span>
                                                    <button
                                                        type="button"
                                                        className="info-icon tooltip-target"
                                                        data-tooltip={currentHeading.tooltip}
                                                        aria-label={currentHeading.tooltip}
                                                    >
                                                        ?
                                                    </button>
                                                </div>
                                            );
                                        })()}
                                        <div className="inbox-header-actions">
                                            <button
                                                type="button"
                                            className="btn btn-save btn-compact tooltip-target"
                                            data-tooltip={t('inbox.tooltip.create', 'Erstellen')}
                                            aria-label={t('inbox.tooltip.create', 'Erstellen')}
                                            onClick={() => setInboxCaptureOpen(true)}
                                        >
                                            <span className="btn-save-icon">
                                                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" stroke="currentColor">
                                                    <path d="M12 5v14M5 12h14" />
                                                </svg>
                                            </span>
                                        </button>
                                        </div>
                                    </div>
                                </div>
                                <div className="dashboard-card-content ui-card-body">
                                    {(() => {
                                        const filteredInboxItems = inboxItems.filter((item) => {
                                            const status = inboxItemStatuses[item.id] || 'eingang';
                                            if (inboxView === 'eingang') return status === 'eingang';
                                            if (inboxView === 'spaeter') return status === 'spaeter';
                                            if (inboxView === 'bearbeitet') return status === 'bearbeitet';
                                            return status === 'archiv';
                                        });
                                        const selectedItem =
                                            filteredInboxItems.find((item) => item.id === selectedInboxId) ||
                                            filteredInboxItems[0] ||
                                            null;
                                        return (
                                            <div className="inbox-layout">
                                                <div className="inbox-sidebar">
                                                    {filteredInboxItems.length === 0 && (
                                                        <div className="dashboard-empty inbox-empty">
                                                            <div className="inbox-empty-title">{t('inbox.empty.title', 'Inbox Zero')}</div>
                                                            <div className="inbox-empty-text">{t('inbox.empty.text', 'No unplanned work right now.')}</div>
                                                        </div>
                                                    )}
                                                    {filteredInboxItems.map((task) => {
                                                        const status = inboxItemStatuses[task.id] || 'eingang';
                                                        const typeLabel = task.kind || t('inbox.incoming', 'Incoming');
                                                        const createdLabel = task.createdAt
                                                            ? new Date(task.createdAt).toLocaleDateString()
                                                            : 'Just now';
                                                        const moved = inboxMovedId === task.id;
                                                        const avatarLabel = task.creatorLabel || typeLabel || task.title;
                                                        const memberInfo = getMemberInfo(activeTenantId, task.creatorId);
                                                        const avatarUrl = memberInfo.avatarUrl || '';
                                                        const avatarInitials = getInitials(memberInfo.label || avatarLabel);
                                                        const plannedScope =
                                                            task.plannedScopeId
                                                                ? (scopeWindowsByBoard[activeTenantId] || []).find(
                                                                    (window) => window.id === task.plannedScopeId
                                                                )
                                                                : null;
                                                        return (
                                                            <button
                                                                key={task.id}
                                                                type="button"
                                                                className={`inbox-sidebar-item${
                                                                    selectedItem?.id === task.id ? ' active' : ''
                                                                }${moved ? ' moved' : ''}`}
                                                                onClick={() => setSelectedInboxId(task.id)}
                                                            >
                                                                <div
                                                                    className={`inbox-avatar${avatarUrl ? ' has-image' : ''} tooltip-target`}
                                                                    aria-label={memberInfo.label || avatarLabel}
                                                                    data-tooltip={memberInfo.label || avatarLabel}
                                                                >
                                                                    {avatarUrl ? (
                                                                        <img src={avatarUrl} alt={memberInfo.label || avatarLabel} />
                                                                    ) : (
                                                                        avatarInitials
                                                                    )}
                                                                </div>
                                                                <div className="inbox-sidebar-body">
                                                                    <div className="inbox-sidebar-title">{task.title}</div>
                                                                    <div className="inbox-sidebar-meta">
                                                                        <span>{createdLabel}</span>
                                                                        {task.priority && (
                                                                            <span
                                                                                className={`badge badge-priority-${String(
                                                                                    task.priority
                                                                                ).toLowerCase()}`}
                                                                            >
                                                                                {task.priority}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                                {selectedItem ? (
                                                    <div className="inbox-detail">
                                                        <div className="inbox-detail-body">
                                                            <div className="inbox-detail-topbar">
                                                                <div className="inbox-detail-user">
                                                                    {(() => {
                                                                        const memberInfo = getMemberInfo(activeTenantId, selectedItem.creatorId);
                                                                        const avatarUrl = memberInfo.avatarUrl || '';
                                                                        const label = memberInfo.label || selectedItem.creatorLabel || selectedItem.title;
                                                                        return (
                                                                            <div
                                                                                className={`inbox-avatar${avatarUrl ? ' has-image' : ''} tooltip-target`}
                                                                                aria-label={label}
                                                                                data-tooltip={label}
                                                                            >
                                                                                {avatarUrl ? (
                                                                                    <img src={avatarUrl} alt={label} />
                                                                                ) : (
                                                                                    getInitials(label)
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })()}
                                                                    {selectedItem.priority && (
                                                                    <span
                                                                        className={`badge badge-priority-${String(
                                                                            selectedItem.priority
                                                                        ).toLowerCase()}`}
                                                                    >
                                                                        {selectedItem.priority}
                                                                    </span>
                                                                )}
                                                                </div>
                                                            <div className="inbox-detail-topbar-actions">
                                                                {inboxView === 'eingang' && (
                                                                    <div className="filter-dropdown inbox-scope-dropdown" ref={inboxScopeRef}>
                                                                            <button
                                                                                type="button"
                                                                                className="icon-action scope-toggle inbox-action tooltip-target"
                                                                                data-tooltip={t('inbox.action.addScopeTooltip', 'Zum Scope hinzufügen')}
                                                                                aria-label={t('inbox.action.addScope', 'Zum Scope hinzufügen')}
                                                                                onClick={() => {
                                                                                    if (inboxScopeMenuId !== selectedItem.id) {
                                                                                        ensureCurrentWeeklyScope();
                                                                                    }
                                                                                    setInboxScopeMenuId((prev) =>
                                                                                        prev === selectedItem.id ? null : selectedItem.id
                                                                                    );
                                                                                }}
                                                                            >
                                                                                <span className="inbox-action-icon" aria-hidden="true">
                                                                                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6">
                                                                                        <circle cx="12" cy="12" r="7.5"></circle>
                                                                                        <circle cx="12" cy="12" r="2.5"></circle>
                                                                                        <path d="M12 4v3"></path>
                                                                                        <path d="M12 17v3"></path>
                                                                                        <path d="M4 12h3"></path>
                                                                                        <path d="M17 12h3"></path>
                                                                                    </svg>
                                                                                </span>
                                                                            </button>
                                                                            {inboxScopeMenuId === selectedItem.id && (
                                                                                <div className="filter-options" role="listbox">
                                                                                    {scopeWindows.length === 0 ? (
                                                                                        <div className="filter-empty">
                                                                                            {t('scope.empty.title', 'No scopes yet')}
                                                                                        </div>
                                                                                    ) : (
                                                                                        <>
                                                                                            {currentWeeklyScope && (
                                                                                                <button
                                                                                                    type="button"
                                                                                                    className="filter-option"
                                                                                                    onClick={() => handleInboxAddToScope(selectedItem, currentWeeklyScope.id)}
                                                                                                >
                                                                                                    <span>Diese Woche</span>
                                                                                                    <span className="filter-option-meta">
                                                                                                        {getScopeDateLabel(currentWeeklyScope)}
                                                                                                    </span>
                                                                                                </button>
                                                                                            )}
                                                                                            {scopeWindows
                                                                                                .filter((window) => window.id !== currentWeeklyScope?.id)
                                                                                                .map((window) => (
                                                                                                    <button
                                                                                                        key={window.id}
                                                                                                        type="button"
                                                                                                        className="filter-option"
                                                                                                        onClick={() => handleInboxAddToScope(selectedItem, window.id)}
                                                                                                    >
                                                                                                        <span>{window.name}</span>
                                                                                                        <span className="filter-option-meta">
                                                                                                            {getScopeDateLabel(window)}
                                                                                                        </span>
                                                                                                    </button>
                                                                                                ))}
                                                                                        </>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                            {inboxView === 'eingang' && (
                                                                <button
                                                                    type="button"
                                                                    className="icon-action inbox-action tooltip-target"
                                                                    data-tooltip="In diese Woche planen"
                                                                    aria-label="In diese Woche planen"
                                                                    onClick={() => handleInboxPlanThisWeek(selectedItem)}
                                                                >
                                                                    <span className="inbox-action-icon" aria-hidden="true">
                                                                        <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
                                                                            <rect x="4" y="5" width="16" height="15" rx="2" />
                                                                            <path d="M16 3v4M8 3v4M4 10h16" />
                                                                            <path d="M9 15l2 2 4-4" />
                                                                        </svg>
                                                                    </span>
                                                                </button>
                                                            )}
                                                            {inboxView === 'eingang' && (
                                                                <button
                                                                    type="button"
                                                                    className="icon-action inbox-action tooltip-target"
                                                                            data-tooltip={t('inbox.action.laterTooltip', 'Later')}
                                                                            aria-label={t('inbox.action.later', 'Later')}
                                                                            onClick={() => setInboxStatus(selectedItem.id, 'spaeter')}
                                                                        >
                                                                            <span className="inbox-action-icon" aria-hidden="true">
                                                                                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
                                                                                    <circle cx="12" cy="12" r="7" />
                                                                                    <path d="M12 7v5l3 3" />
                                                                                </svg>
                                                                            </span>
                                                                        </button>
                                                                    )}
                                                                    {(inboxView === 'eingang' || inboxView === 'spaeter' || inboxView === 'bearbeitet') && (
                                                                        <button
                                                                            type="button"
                                                                            className="icon-action inbox-action tooltip-target"
                                                                            data-tooltip={t('inbox.action.archiveTooltip', 'Archive')}
                                                                            aria-label={t('inbox.action.archive', 'Archive')}
                                                                            onClick={() => setInboxStatus(selectedItem.id, 'archiv')}
                                                                        >
                                                                            <span className="inbox-action-icon" aria-hidden="true">
                                                                                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
                                                                                    <path d="M4 7h16" />
                                                                                    <path d="M6 7v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7" />
                                                                                    <path d="M9 11h6" />
                                                                                </svg>
                                                                            </span>
                                                                        </button>
                                                                    )}
                                                                    {inboxView === 'archiv' && (
                                                                        <button
                                                                    type="button"
                                                                    className="icon-action inbox-action tooltip-target"
                                                                    data-tooltip={t('inbox.action.backTooltip', 'Back to inbox')}
                                                                    aria-label={t('inbox.action.backToInbox', 'Zum Eingang')}
                                                                    onClick={() => {
                                                                        setInboxStatus(selectedItem.id, 'eingang');
                                                                        setSelectedInboxId(null);
                                                                    }}
                                                                >
                                                                    <span className="inbox-action-icon" aria-hidden="true">
                                                                        <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
                                                                            <path d="M14 7l-5 5 5 5" />
                                                                            <path d="M19 12H9" />
                                                                        </svg>
                                                                    </span>
                                                                </button>
                                                            )}
                                                            {inboxView === 'spaeter' && (
                                                                <button
                                                                    type="button"
                                                                    className="icon-action inbox-action tooltip-target"
                                                                    data-tooltip={t('inbox.action.moveToInboxTooltip', 'Zurück in den Eingang')}
                                                                    aria-label={t('inbox.action.moveToInbox', 'Zur Eingang')}
                                                                    onClick={() => setInboxStatus(selectedItem.id, 'eingang')}
                                                                >
                                                                    <span className="inbox-action-icon" aria-hidden="true">
                                                                        <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
                                                                            <path d="M9 12h8" />
                                                                            <path d="M12 7l-5 5 5 5" />
                                                                        </svg>
                                                                    </span>
                                                                </button>
                                                            )}
                                                            {(inboxView === 'eingang' || inboxView === 'spaeter') && selectedItem && (
                                                                    <button
                                                                        className="icon-action inbox-action tooltip-target inbox-action-edit"
                                                                        data-tooltip="Bearbeiten"
                                                                        aria-label="Bearbeiten"
                                                                        onClick={() => handleInboxEdit(selectedItem)}
                                                                    >
                                                                        <span className="inbox-action-icon" aria-hidden="true">
                                                                            <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
                                                                                <path d="M4 20h4l10-10-4-4L4 16v4z" />
                                                                                <path d="M14 6l4 4" />
                                                                            </svg>
                                                                        </span>
                                                                    </button>
                                                                )}
                                                        </div>
                                                    </div>
                                                            <div className="inbox-detail-meta" role="list">
                                                                {selectedItem.source && (
                                                                    <span className="inbox-detail-extra" role="listitem">
                                                                        <strong>{t('inbox.field.source', 'Source')}:</strong>{' '}
                                                                        {getSourceLabel(selectedItem.source)}
                                                                    </span>
                                                                )}
                                                                {selectedItem.suggestedAction && (
                                                                    <span className="inbox-detail-extra" role="listitem">
                                                                        <strong>{t('inbox.field.action', 'Suggested action')}:</strong>{' '}
                                                                        {getActionLabel(selectedItem.suggestedAction)}
                                                                    </span>
                                                                )}
                                                                {(() => {
                                                                    const plannedScopeId =
                                                                        selectedItem.plannedScopeId || inboxPlannedScopes[selectedItem.id];
                                                                    if (inboxView !== 'bearbeitet' || !plannedScopeId) return null;
                                                                    const plannedScopeName =
                                                                        (scopeWindowsByBoard[activeTenantId] || []).find(
                                                                            (window) => window.id === plannedScopeId
                                                                        )?.name || plannedScopeId;
                                                                    return (
                                                                        <span className="inbox-detail-extra" role="listitem">
                                                                            <strong>Verschoben nach:</strong>{' '}
                                                                            <button
                                                                                type="button"
                                                                                className="badge"
                                                                                onClick={() => {
                                                                                    openScopeDetail(plannedScopeId);
                                                                                    setView('scope');
                                                                                    setInboxView('bearbeitet');
                                                                                }}
                                                                            >
                                                                                {plannedScopeName}
                                                                            </button>
                                                                        </span>
                                                                    );
                                                                })()}
                                                            </div>
                                                            <div className="inbox-detail-header">
                                                                <h3>{selectedItem.title}</h3>
                                                                <span className="inbox-detail-date">
                                                                    {new Date(selectedItem.createdAt).toLocaleDateString()}
                                                                </span>
                                                            </div>
                                                            {selectedItem.description && (
                                                                <p className="inbox-detail-description">{selectedItem.description}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="inbox-empty-detail">
                                                        <div className="inbox-empty-title">
                                                            {t('inbox.empty.title', 'Inbox Zero')}
                                                        </div>
                                                        <div className="inbox-empty-text">
                                                            {t('inbox.empty.text', 'No unplanned work right now.')}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        )}
                    </div>
                ) : view === 'initiatives' ? (
                    <>
                        {activeTenantId && initiativeScreen !== 'detail' && (
                            <div className="filter-bar">
                                <div
                                    className="view-switch"
                                    role="tablist"
                                    aria-label="Initiative filter"
                                    style={{
                                        ['--active-index' as any]: initiativeTab === 'CLOSED' ? 1 : 0,
                                        ['--segment-count' as any]: 2,
                                        alignSelf: 'flex-start'
                                    }}
                                >
                                    <button
                                        className={`view-pill ${initiativeTab === 'ACTIVE' ? 'active' : ''}`}
                                        onClick={() => setInitiativeTab('ACTIVE')}
                                        role="tab"
                                        aria-selected={initiativeTab === 'ACTIVE'}
                                    >
                                        Aktuell
                                    </button>
                                    <button
                                        className={`view-pill ${initiativeTab === 'CLOSED' ? 'active' : ''}`}
                                        onClick={() => setInitiativeTab('CLOSED')}
                                        role="tab"
                                        aria-selected={initiativeTab === 'CLOSED'}
                                    >
                                        Beendet
                                    </button>
                                </div>
                            </div>
                        )}
                        <div className="dashboard-panel initiatives-shell">
                        {!activeTenantId ? (
                            <div className="empty-state">Select a huddle to manage initiatives.</div>
                        ) : initiativeScreen === 'detail' && activeInitiative ? (
                            <div className="initiative-detail">
                                <div className="scope-detail-body">
                                    <div className="initiative-detail-grid">
                                        <div className="scope-section">
                                            <div className="scope-section-title">Goal / Outcome</div>
                                            <div className="scope-section-content">
                                                <div className="table-details-grid">
                                                    <div>
                                                        <div className="table-details-label">Ziel</div>
                                                        <div className="table-details-text">
                                                            {activeInitiative.goal || 'Kein Ziel definiert.'}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="table-details-label">Description</div>
                                                        <div className="table-details-text">
                                                            {activeInitiative.description || 'No description yet.'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="scope-section">
                                        <div
                                            className="scope-section-title"
                                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}
                                        >
                                            <span>Scopes in this initiative</span>
                                            <div className="filter-dropdown">
                                                <button
                                                    type="button"
                                                    className="icon-action create"
                                                    onClick={() =>
                                                        setInitiativeScopePickerId((prev) =>
                                                            prev === activeInitiative.id ? '' : activeInitiative.id
                                                        )
                                                    }
                                                    aria-haspopup="listbox"
                                                    aria-expanded={initiativeScopePickerId === activeInitiative.id}
                                                    data-tooltip="Scope hinzufügen"
                                                    aria-label="Scope hinzufügen"
                                                >
                                                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2">
                                                        <path d="M12 5v14" />
                                                        <path d="M5 12h14" />
                                                    </svg>
                                                </button>
                                                {initiativeScopePickerId === activeInitiative.id && (
                                                    <div className="filter-options" role="listbox">
                                                        <button
                                                            type="button"
                                                            className="filter-option"
                                                            onClick={() => {
                                                                setInitiativeScopeCreateForId(activeInitiative.id);
                                                                setIsScopeCreateOpen(true);
                                                                setInitiativeScopePickerId('');
                                                            }}
                                                        >
                                                            <span>Scope erstellen</span>
                                                            <span className="filter-option-meta">Neuen Scope anlegen</span>
                                                        </button>
                                                        <div className="filter-option filter-option-clear" aria-hidden="true">
                                                            Vorhandene Scopes
                                                        </div>
                                                        {initiativeScopeOptions.length === 0 ? (
                                                            <div className="filter-empty">Keine Scopes zum Hinzufügen.</div>
                                                        ) : (
                                                            initiativeScopeOptions.map((scope) => (
                                                                <button
                                                                    key={scope.id}
                                                                    type="button"
                                                                    className="filter-option"
                                                                    onClick={() => {
                                                                        setScopeInitiative(scope.id, activeInitiative.id);
                                                                        setInitiativeScopePickerId('');
                                                                    }}
                                                                >
                                                                    <span>{scope.name}</span>
                                                                    <span className="filter-option-meta">
                                                                        {getScopeDateLabel(scope)}
                                                                    </span>
                                                                </button>
                                                            ))
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="scope-section-content">
                                                <div className="scope-section-list">
                                                    {initiativeScopes.length === 0 ? (
                                                        <div className="scope-empty">No scopes linked yet.</div>
                                                    ) : (
                                                        initiativeScopes.map((scope) => (
                                                            <button
                                                                key={scope.id}
                                                                type="button"
                                                                className="scope-section-item"
                                                                onClick={() => openScopeDetail(scope.id)}
                                                            >
                                                                <div className="scope-section-main">
                                                                    <div className="scope-section-item-title">{scope.name}</div>
                                                                    <div className="scope-section-item-meta">
                                                                        <span className="scope-section-chip">
                                                                            {getScopeDateLabel(scope)}
                                                                        </span>
                                                                        <span className="scope-section-chip">
                                                                            {scope.taskIds.length} tasks
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <span className={`scope-section-status${scope.completionStatus ? ' done' : ''}`}>
                                                                    {scope.completionStatus ? 'Completed' : 'Active'}
                                                                </span>
                                                            </button>
                                                        ))
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="scope-section">
                                            <div className="scope-section-title">Progress</div>
                                            <div className="scope-section-content">
                                                <div className="initiative-progress">
                                                    <div className="initiative-progress-row">
                                                        <div>
                                                            <div className="initiative-progress-label">Task completion</div>
                                                            <div className="initiative-progress-value">
                                                                {activeInitiativeMetrics?.doneTasks ?? 0} / {activeInitiativeMetrics?.totalTasks ?? 0} done
                                                            </div>
                                                        </div>
                                                        <div className="initiative-progress-percent">
                                                            {activeInitiativeMetrics?.taskCompletion ?? 0}%
                                                        </div>
                                                    </div>
                                                    <div className="initiative-progress-bar">
                                                        <span
                                                            className="initiative-progress-fill"
                                                            style={{ width: `${activeInitiativeMetrics?.taskCompletion ?? 0}%` }}
                                                        />
                                                    </div>
                                                    <div className="initiative-progress-row">
                                                        <div>
                                                            <div className="initiative-progress-label">Scope completion</div>
                                                            <div className="initiative-progress-value">
                                                                {activeInitiativeMetrics?.closedScopes ?? 0} / {activeInitiativeMetrics?.totalScopes ?? 0} closed
                                                            </div>
                                                        </div>
                                                        <div className="initiative-progress-percent">
                                                            {activeInitiativeMetrics?.scopeCompletion ?? 0}%
                                                        </div>
                                                    </div>
                                                    <div className="initiative-progress-bar">
                                                        <span
                                                            className="initiative-progress-fill"
                                                            style={{ width: `${activeInitiativeMetrics?.scopeCompletion ?? 0}%` }}
                                                        />
                                                    </div>
                                                    <div className="initiative-progress-stats">
                                                        <div className="initiative-progress-stat">
                                                            <span>Total scopes</span>
                                                            <strong>{activeInitiativeMetrics?.totalScopes ?? 0}</strong>
                                                        </div>
                                                        <div className="initiative-progress-stat">
                                                            <span>Active scopes</span>
                                                            <strong>{activeInitiativeMetrics?.activeScopes ?? 0}</strong>
                                                        </div>
                                                        <div className="initiative-progress-stat">
                                                            <span>Open tasks</span>
                                                            <strong>{activeInitiativeMetrics?.openTasks ?? 0}</strong>
                                                        </div>
                                                        <div className="initiative-progress-stat">
                                                            <span>Done tasks</span>
                                                            <strong>{activeInitiativeMetrics?.doneTasks ?? 0}</strong>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="dashboard-card dashboard-list ui-card">
                                    <div className="dashboard-card-title ui-card-header">
                                        <div className="dashboard-card-title-row inbox-header-row">
                                            <div className="inbox-header-left">
                                                <span>Initiatives</span>
                                            </div>
                                            <div className="inbox-header-actions">
                                                <button
                                                    type="button"
                                                    className="btn btn-save btn-compact tooltip-target"
                                                    data-tooltip="Initiative erstellen"
                                                    aria-label="Initiative erstellen"
                                                    onClick={() => setIsInitiativeCreateOpen(true)}
                                                >
                                                    <span className="btn-save-icon">
                                                        <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" stroke="currentColor">
                                                            <path d="M12 5v14M5 12h14" />
                                                        </svg>
                                                    </span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="dashboard-card-content ui-card-body">
                                        {filteredInitiatives.length === 0 ? (
                                            <div className="empty-state">
                                                <div className="inbox-empty-title">Keine Initiativen</div>
                                                <div className="inbox-empty-text">
                                                    Erstelle deine erste Initiative, um deine Scopes zu bündeln.
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="scope-window-grid">
                                                {filteredInitiatives.map((initiative) => {
                                                    const metrics = initiativeMetricsById.get(initiative.id);
                                                    return (
                                                        <button
                                                            key={initiative.id}
                                                            type="button"
                                                            className={`scope-window-card${activeInitiativeId === initiative.id ? ' active' : ''}`}
                                                            onClick={() => openInitiativeDetail(initiative.id)}
                                                        >
                                                            <div className="ui-card-body scope-window-body">
                                                                <div className="scope-window-header">
                                                                    <div>
                                                                        <div className="scope-window-title">{initiative.name}</div>
                                                                        <div className={`scope-window-meta scope-window-meta-${initiative.status.toLowerCase()}`}>
                                                                            {initiative.status === 'ACTIVE' ? 'Active' : 'Closed'}
                                                                        </div>
                                                                    </div>
                                                                    <div className="scope-detail-actions">
                                                                        <span className="dashboard-badge">
                                                                            {metrics?.totalScopes ?? 0} scopes
                                                                        </span>
                                                                        <span className="dashboard-badge">
                                                                            {metrics?.totalTasks ?? 0} tasks
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <div className="scope-card-footer">
                                                                    <div className="task-card-people">
                                                                        {initiative.ownerId
                                                                            ? renderAvatarStack(activeTenantId, [initiative.ownerId])
                                                                            : null}
                                                                    </div>
                                                                    {initiative.goal && (
                                                                        <span className="scope-task-origin"><span>Ziel:</span> {initiative.goal}</span>
                                                                    )}
                                                                </div>
                                                                <div className="scope-window-health">
                                                                    <div className="scope-window-progress">
                                                                        <div className="scope-window-progress-bar">
                                                                            <span style={{ width: `${metrics?.taskCompletion ?? 0}%` }} />
                                                                        </div>
                                                                        <div className="scope-window-progress-label">
                                                                            {metrics?.taskCompletion ?? 0}% tasks done
                                                                        </div>
                                                                    </div>
                                                                    <div className="scope-window-health-row">
                                                                        <span>Open</span>
                                                                        <span>{metrics?.openTasks ?? 0}</span>
                                                                    </div>
                                                                    <div className="scope-window-health-row">
                                                                        <span>Closed scopes</span>
                                                                        <span>{metrics?.closedScopes ?? 0}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </>
                ) : (
                    <>
                        <div className="filter-bar">
                                <div className="view-switch"
                                role="tablist"
                                aria-label="View switcher"
                                style={{
                                    ['--active-index' as any]: view === 'kanban' ? 1 : view === 'timeline' ? 2 : 0,
                                    ['--segment-count' as any]: 3,
                                }}
                            >
                                <button
                                    className={`view-pill ${view === 'table' ? 'active' : ''}`}
                                    onClick={() => setView('table')}
                                    role="tab"
                                    aria-selected={view === 'table'}
                                >
                                    List
                                </button>
                                <button
                                    className={`view-pill ${view === 'kanban' ? 'active' : ''}`}
                                    onClick={() => setView('kanban')}
                                    role="tab"
                                    aria-selected={view === 'kanban'}
                                >
                                    Board
                                </button>
                                <button
                                    className={`view-pill ${view === 'timeline' ? 'active' : ''}`}
                                    onClick={() => setView('timeline')}
                                    role="tab"
                                    aria-selected={view === 'timeline'}
                                >
                                    Timeline
                                </button>
                            </div>
                            <div className="filter-actions">
                                <div className="filter-quick">
                                    {[
                                        { key: 'MINE', label: 'My tasks' },
                                        { key: 'OVERDUE', label: 'Overdue' },
                                        { key: 'WEEK', label: 'This week' }
                                    ].map((item) => (
                                        <button
                                            key={item.key}
                                            type="button"
                                            className={`filter-quick-pill${quickFilter === item.key ? ' active' : ''}`}
                                            onClick={() => setQuickFilter((prev) => (prev === item.key ? 'ALL' : (item.key as any)))}
                                        >
                                            {item.label}
                                        </button>
                                    ))}
                                </div>
                                {view === 'timeline' && (
                                    <div className="filter-dropdown" ref={timelineRangeRef}>
                                        <button
                                            type="button"
                                            className="filter-select"
                                            onClick={() => setTimelineRangeOpen((prev) => !prev)}
                                            aria-haspopup="listbox"
                                            aria-expanded={timelineRangeOpen}
                                        >
                                            {timelineRange === 'auto' ? 'Auto range' : `${timelineRange} days`}
                                        </button>
                                        {timelineRangeOpen && (
                                            <div className="filter-options" role="listbox">
                                                {[
                                                    { value: 'auto', label: 'Auto range' },
                                                    { value: 14, label: '14 days' },
                                                    { value: 30, label: '30 days' },
                                                    { value: 60, label: '60 days' },
                                                    { value: 90, label: '90 days' },
                                                ].map((option) => (
                                                    <button
                                                        key={option.value}
                                                        type="button"
                                                        className={`filter-option ${timelineRange === option.value ? 'active' : ''}`}
                                                        onClick={() => {
                                                            setTimelineRange(option.value as any);
                                                            setTimelineRangeOpen(false);
                                                        }}
                                                        role="option"
                                                        aria-selected={timelineRange === option.value}
                                                    >
                                                        {option.label}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                                <div className="filter-dropdown" ref={priorityFilterRef}>
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
                                    <div className="filter-dropdown" ref={statusFilterRef}>
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
                                <div className="filter-dropdown" ref={labelFilterRef}>
                                    <button
                                        type="button"
                                        className="filter-select"
                                        onClick={() => setLabelFilterOpen((prev) => !prev)}
                                        aria-haspopup="listbox"
                                        aria-expanded={labelFilterOpen}
                                    >
                                        {selectedLabelFilters.length > 0
                                            ? `Labels (${selectedLabelFilters.length})`
                                            : 'All labels'}
                                    </button>
                                    {labelFilterOpen && (
                                        <div className="filter-options filter-options-multi" role="listbox">
                                            {labelFilterOptions.length === 0 && (
                                                <div className="filter-empty">No labels found</div>
                                            )}
                                            {labelFilterOptions.map((label) => {
                                                const active = selectedLabelFilters.includes(label);
                                                return (
                                                    <button
                                                        key={label}
                                                        type="button"
                                                        className={`filter-option ${active ? 'active' : ''}`}
                                                        onClick={() => {
                                                            setSelectedLabelFilters((prev) =>
                                                                prev.includes(label)
                                                                    ? prev.filter((item) => item !== label)
                                                                    : prev.concat(label)
                                                            );
                                                        }}
                                                        role="option"
                                                        aria-selected={active}
                                                    >
                                                        <span>{label}</span>
                                                        {active && <span className="filter-option-check">✓</span>}
                                                    </button>
                                                );
                                            })}
                                            {selectedLabelFilters.length > 0 && (
                                                <button
                                                    type="button"
                                                    className="filter-option filter-option-clear"
                                                    onClick={() => setSelectedLabelFilters([])}
                                                >
                                                    Clear selection
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <label
                                    className={`filter-checkbox filter-favorites ${filterFavorites ? 'active' : ''}`}
                                    data-tooltip="Nur Favoriten"
                                    aria-label="Nur Favoriten"
                                >
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
                                {activeTenantId && showScopeDropRow && (
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
                                            <span>{getStatusLabel(column.status)}</span>
                                            <span>{displayTasks.length}</span>
                                        </div>
                                        <div className="column-content">
                                        {displayTasks.map((task: TaskView) => {
                                            const checklistDone = task.checklist.filter((item) => item.done).length;
                                            const checklistTotal = task.checklist.length;
                                            const isChecklistComplete = checklistTotal > 0 && checklistDone === checklistTotal;
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
                                                        draggable={isDraggable && canEditActiveScopeItems}
                                                        onDragStart={(e) => (isDraggable && canEditActiveScopeItems ? onDragStart(e, task.id) : e.preventDefault())}
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
                                                                <span
                                                                    className={`badge badge-priority-${task.priority.toLowerCase()} tooltip-target`}
                                                                    data-tooltip={`Priority: ${task.priority}`}
                                                                >
                                                                    {task.priority}
                                                                </span>
                                                            </div>
                                                            <div className="task-card-header">
                                                                <div className="task-title-row">
                                                                    {task.title}
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    className={`favorite-badge favorite-badge-button${task.isFavorite ? ' active' : ''}`}
                                                                    onClick={(event) => {
                                                                        event.stopPropagation();
                                                                        toggleFavorite(task);
                                                                    }}
                                                                    title={task.isFavorite ? 'Unfavorite' : 'Favorite'}
                                                                    aria-label={task.isFavorite ? 'Unfavorite task' : 'Favorite task'}
                                                                >
                                                                    {task.isFavorite ? '★' : '☆'}
                                                                </button>
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
                        ) : view === 'timeline' ? (
                            renderTimeline(visibleTasksForView, 'No tasks to show on timeline.')
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
                {isScopeCreateOpen && (
                    <div className="modal-overlay">
                        <div className="modal-content settings-modal">
                            <div className="panel-header">
                                <div>
                                    <div className="panel-title">Create scope window</div>
                                    <div className="panel-subtitle">Bundle tasks into a focused sprint scope.</div>
                                </div>
                                <button className="panel-close" onClick={() => setIsScopeCreateOpen(false)} aria-label="Close">×</button>
                            </div>
                            <div className="panel-body">
                                <div className="panel-section">
                                    <div className="section-title">Details</div>
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
                                    </div>
                                    <div className="scope-create-grid">
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
                                        <label>
                                            Visibility
                                            <select
                                                value={scopeDraft.visibility}
                                                onChange={(event) =>
                                                    setScopeDraft((prev) => ({
                                                        ...prev,
                                                        visibility: event.target.value === 'personal' ? 'personal' : 'shared',
                                                    }))
                                                }
                                            >
                                                <option value="shared">Shared</option>
                                                <option value="personal">Personal</option>
                                            </select>
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
                                </div>
                            </div>
                            <div className="panel-footer">
                                <div className="panel-actions">
                                    <div className="panel-actions-right">
                                        <button
                                            className="btn btn-save btn-compact"
                                            onClick={handleScopeCreate}
                                            disabled={!scopeDraft.name.trim() || !scopeKey}
                                            aria-label="Create scope window"
                                        >
                                            <span className="btn-save-icon" aria-hidden="true">
                                                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
                                                    <path d="M4 4h12l4 4v12H4z" />
                                                    <path d="M7 4v6h8V4" />
                                                    <path d="M7 14h10v6H7z" />
                                                </svg>
                                            </span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {isInitiativeCreateOpen && (
                    <div className="modal-overlay">
                        <div className="modal-content settings-modal">
                            <div className="panel-header">
                                <div>
                                    <div className="panel-title">{initiativeEditId ? 'Edit initiative' : 'Create initiative'}</div>
                                    <div className="panel-subtitle">
                                        {initiativeEditId ? 'Update goal, owner, and description.' : 'Define the WHY for upcoming scopes.'}
                                    </div>
                                </div>
                                <button
                                    className="panel-close"
                                    onClick={() => {
                                        setIsInitiativeCreateOpen(false);
                                        setInitiativeEditId(null);
                                        setInitiativeDraft({ name: '', goal: '', description: '', ownerId: '' });
                                    }}
                                    aria-label="Close"
                                >
                                    ×
                                </button>
                            </div>
                            <div className="panel-body">
                                <div className="panel-section">
                                    <div className="section-title">Details</div>
                                    <div className="scope-create-grid">
                                        <label>
                                            Title
                                            <input
                                                type="text"
                                                placeholder="e.g. Accelerate onboarding"
                                                value={initiativeDraft.name}
                                                onChange={(event) =>
                                                    setInitiativeDraft((prev) => ({ ...prev, name: event.target.value }))
                                                }
                                            />
                                        </label>
                                    </div>
                                    <div className="scope-create-grid">
                                        <label>
                                            Ziel
                                            <input
                                                type="text"
                                                placeholder="e.g. Improve activation rate"
                                                value={initiativeDraft.goal}
                                                onChange={(event) =>
                                                    setInitiativeDraft((prev) => ({ ...prev, goal: event.target.value }))
                                                }
                                            />
                                        </label>
                                        <label>
                                            Owner
                                            <select
                                                value={initiativeDraft.ownerId}
                                                onChange={(event) =>
                                                    setInitiativeDraft((prev) => ({ ...prev, ownerId: event.target.value }))
                                                }
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
                                    <div className="scope-create-grid">
                                        <label className="scope-create-span">
                                            Description
                                            <textarea
                                                rows={3}
                                                placeholder="Optional outcome description."
                                                value={initiativeDraft.description}
                                                onChange={(event) =>
                                                    setInitiativeDraft((prev) => ({ ...prev, description: event.target.value }))
                                                }
                                            />
                                        </label>
                                    </div>
                                </div>
                                {initiativeEditId && (
                                    <div className="panel-section">
                                        <div className="section-title">Status</div>
                                        <div className="panel-text">
                                            {initiativeLookup.get(initiativeEditId)?.status === 'ACTIVE'
                                                ? 'Initiative is active.'
                                                : 'Initiative is closed.'}
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                                            {initiativeLookup.get(initiativeEditId)?.status === 'ACTIVE' ? (
                                                <button
                                                    type="button"
                                                    className="btn btn-secondary btn-compact"
                                                    onClick={() => handleInitiativeClose(initiativeEditId)}
                                                >
                                                    Close Initiative
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    className="btn btn-secondary btn-compact"
                                                    onClick={() => handleInitiativeReopen(initiativeEditId)}
                                                >
                                                    Reopen Initiative
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                                {initiativeEditId && (
                                    <div className="panel-section panel-danger">
                                        <div className="section-title">Danger zone</div>
                                        <div className="panel-text">
                                            Delete this initiative and unlink its scopes.
                                        </div>
                                        <button
                                            type="button"
                                            className="btn btn-delete btn-compact"
                                            onClick={() => {
                                                handleInitiativeDelete(initiativeEditId);
                                                setIsInitiativeCreateOpen(false);
                                                setInitiativeEditId(null);
                                                setInitiativeDraft({ name: '', goal: '', description: '', ownerId: '' });
                                            }}
                                        >
                                            Delete Initiative
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="panel-footer">
                                <div className="panel-actions">
                                    <div className="panel-actions-right">
                                        <button
                                            className="btn btn-save btn-compact"
                                            onClick={initiativeEditId ? handleInitiativeUpdate : handleInitiativeCreate}
                                            disabled={!initiativeDraft.name.trim()}
                                            aria-label={initiativeEditId ? 'Save changes' : 'Create initiative'}
                                        >
                                            <span className="btn-save-icon" aria-hidden="true">
                                                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
                                                    <path d="M4 4h12l4 4v12H4z" />
                                                    <path d="M7 4v6h8V4" />
                                                    <path d="M7 14h10v6H7z" />
                                                </svg>
                                            </span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                
            </main>
            </div>

            {isBoardSettingsOpen && (
                <div className="modal-overlay">
                    <div className="modal-content settings-modal">
                        <div className="panel-header">
                            <div>
                                    <div className="panel-title">Task settings</div>
                                    <div className="panel-subtitle">Manage this task list</div>
                            </div>
                            <button className="panel-close" onClick={() => setIsBoardSettingsOpen(false)} aria-label="Close">×</button>
                        </div>
                        <div className="panel-body">
                            <div className="panel-section">
                                <div className="section-title">Tasks</div>
                                <div className="member-name">{activeBoard?.name || activeBoardId || 'Tasks'}</div>
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
                                <div className="panel-text">Delete this task list and all tasks, objectives, and key results.</div>
                                <button className="btn btn-delete btn-compact" onClick={handleDeleteBoard}>
                                    Delete task list
                                </button>
                            </div>
                        </div>
                        <div className="panel-footer">
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
                            <div className="panel-section">
                                <div className="section-title">Visibility</div>
                                <div className="member-meta">
                                    {(() => {
                                        return (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                <select
                                                    value={scopeSettingsDraft.visibility}
                                                    onChange={(event) =>
                                                        setScopeSettingsDraft((prev) => ({
                                                            ...prev,
                                                            visibility: event.target.value === 'personal' ? 'personal' : 'shared',
                                                        }))
                                                    }
                                                >
                                                    <option value="shared">Shared</option>
                                                    <option value="personal">Personal</option>
                                                </select>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                            <div className="panel-section">
                                <div className="section-title">Initiative</div>
                                <div className="member-meta" ref={scopeInitiativeRef} style={{ position: 'relative' }}>
                                    <div className="filter-dropdown">
                                        <button
                                            type="button"
                                            className="filter-select"
                                            onClick={() => {
                                                if (!canManageActiveScope || isActiveScopeCompleted) return;
                                                if (activeScopeWindow.id.startsWith(WEEKLY_SCOPE_PREFIX)) return;
                                                setScopeInitiativeOpen((prev) => !prev);
                                            }}
                                            aria-haspopup="listbox"
                                            aria-expanded={scopeInitiativeOpen}
                                            disabled={
                                                !canManageActiveScope
                                                || isActiveScopeCompleted
                                                || activeScopeWindow.id.startsWith(WEEKLY_SCOPE_PREFIX)
                                            }
                                        >
                                            {activeScopeWindow.initiativeId
                                                ? initiativeLookup.get(activeScopeWindow.initiativeId)?.name || 'Initiative'
                                                : 'Keine'}
                                        </button>
                                        {scopeInitiativeOpen && (
                                            <div className="filter-options" role="listbox">
                                                <button
                                                    type="button"
                                                    className={`filter-option${!activeScopeWindow.initiativeId ? ' active' : ''}`}
                                                    onClick={() => {
                                                        setScopeInitiative(activeScopeWindow.id, null);
                                                        setScopeInitiativeOpen(false);
                                                    }}
                                                >
                                                    Keine
                                                </button>
                                                {initiativeOptions.length === 0 ? (
                                                    <div className="filter-empty">Noch keine Initiativen.</div>
                                                ) : (
                                                    initiativeOptions.map((initiative) => (
                                                        <button
                                                            key={initiative.id}
                                                            type="button"
                                                            className={`filter-option${activeScopeWindow.initiativeId === initiative.id ? ' active' : ''}`}
                                                            onClick={() => {
                                                                setScopeInitiative(activeScopeWindow.id, initiative.id);
                                                                setScopeInitiativeOpen(false);
                                                            }}
                                                        >
                                                            <span>{initiative.name}</span>
                                                            <span className="filter-option-meta">
                                                                {initiative.status === 'ACTIVE' ? 'Aktiv' : 'Beendet'}
                                                            </span>
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    {activeScopeWindow.id.startsWith(WEEKLY_SCOPE_PREFIX) && (
                                        <div className="panel-text">
                                            Weekly Scopes können keiner Initiative zugewiesen werden.
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="panel-section">
                                <div className="section-title">Members</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                        <select
                                            value={scopeMemberPickerId}
                                            onChange={(event) => setScopeMemberPickerId(event.target.value)}
                                        >
                                            <option value="">Select member</option>
                                            {getMembersForTenant(activeTenantId)
                                                .filter((member) => !scopeSettingsDraft.members.some((entry) => entry.userId === member.userId))
                                                .map((member) => (
                                                    <option key={member.userId} value={member.userId}>
                                                        {member.user?.name || member.user?.email || member.userId}
                                                    </option>
                                                ))}
                                        </select>
                                        <select
                                            value={scopeMemberPickerRole}
                                            onChange={(event) =>
                                                setScopeMemberPickerRole(
                                                    event.target.value === 'ADMIN'
                                                        ? 'ADMIN'
                                                        : event.target.value === 'MEMBER'
                                                            ? 'MEMBER'
                                                            : 'VIEWER'
                                                )
                                            }
                                        >
                                            <option value="ADMIN">Admin</option>
                                            <option value="MEMBER">Member</option>
                                            <option value="VIEWER">Viewer</option>
                                        </select>
                                        <button
                                            className="btn btn-secondary btn-compact"
                                            type="button"
                                            disabled={!scopeMemberPickerId}
                                            onClick={() => {
                                                if (!scopeMemberPickerId) return;
                                                setScopeSettingsDraft((prev) => ({
                                                    ...prev,
                                                    members: prev.members.concat({
                                                        userId: scopeMemberPickerId,
                                                        role: scopeMemberPickerRole,
                                                    }),
                                                }));
                                                setScopeMemberPickerId('');
                                                setScopeMemberPickerRole('MEMBER');
                                            }}
                                        >
                                            Add
                                        </button>
                                    </div>
                                    {scopeSettingsDraft.members.length === 0 ? (
                                        <div className="member-meta">No members yet.</div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            {scopeSettingsDraft.members.map((member) => (
                                                <div key={member.userId} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center' }}>
                                                    <span className="member-meta">{getMemberLabel(activeTenantId, member.userId)}</span>
                                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                        <select
                                                            value={member.role}
                                                            onChange={(event) =>
                                                                setScopeSettingsDraft((prev) => ({
                                                                    ...prev,
                                                                    members: prev.members.map((entry) =>
                                                                        entry.userId === member.userId
                                                                            ? {
                                                                                ...entry,
                                                                                role: event.target.value === 'ADMIN'
                                                                                    ? 'ADMIN'
                                                                                    : event.target.value === 'MEMBER'
                                                                                        ? 'MEMBER'
                                                                                        : 'VIEWER',
                                                                            }
                                                                            : entry
                                                                    ),
                                                                }))
                                                            }
                                                        >
                                                            <option value="ADMIN">Admin</option>
                                                            <option value="MEMBER">Member</option>
                                                            <option value="VIEWER">Viewer</option>
                                                        </select>
                                                        <button
                                                            className="btn btn-ghost btn-compact"
                                                            type="button"
                                                            onClick={() =>
                                                                setScopeSettingsDraft((prev) => ({
                                                                    ...prev,
                                                                    members: prev.members.filter((entry) => entry.userId !== member.userId),
                                                                }))
                                                            }
                                                        >
                                                            Remove
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
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
                        </div>
                        <div className="panel-footer">
                            <div className="panel-actions">
                                <div className="panel-actions-right">
                                    <button
                                        className="btn btn-save btn-compact"
                                        onClick={handleScopeSettingsSave}
                                        disabled={!scopeSettingsDraft.name.trim() || scopeSettingsDateInvalid}
                                        aria-label="Save changes"
                                    >
                                        <span className="btn-save-icon" aria-hidden="true">
                                            <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
                                                <path d="M4 4h12l4 4v12H4z" />
                                                <path d="M7 4v6h8V4" />
                                                <path d="M7 14h10v6H7z" />
                                            </svg>
                                        </span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isScopeCloseOpen && activeScopeWindow && (
                <div className="modal-overlay">
                    <div className="modal-content settings-modal">
                        <div className="panel-header">
                            <div>
                                <div className="panel-title">Scope abschließen</div>
                                <div className="panel-subtitle">Ergebnis festhalten und offene Tasks verschieben.</div>
                            </div>
                            <button className="panel-close" onClick={() => setIsScopeCloseOpen(false)} aria-label="Close">×</button>
                        </div>
                        <div className="panel-body">
                            <div className="panel-section">
                                <div className="section-title">Ziel</div>
                                <div className="scope-close-grid">
                                    <label className="scope-close-field">
                                        <span>Ziel erreicht?</span>
                                        <select
                                            value={scopeCompletionStatus}
                                            onChange={(event) => setScopeCompletionStatus(event.target.value as any)}
                                        >
                                            <option value="">Auswählen</option>
                                            <option value="YES">Ja</option>
                                            <option value="PARTIAL">Teilweise</option>
                                            <option value="NO">Nein</option>
                                        </select>
                                    </label>
                                    <label className="scope-close-field scope-close-field-span">
                                        <span>Kommentar (optional)</span>
                                        <textarea
                                            rows={3}
                                            value={scopeCompletionComment}
                                            onChange={(event) => setScopeCompletionComment(event.target.value)}
                                            placeholder="Kurze Einordnung zum Ergebnis"
                                        />
                                    </label>
                                </div>
                            </div>
                            <div className="panel-section">
                                <div className="section-title">Offene Tasks</div>
                                <div className="scope-close-row">
                                    <div className="scope-close-open">
                                        <span>Offene Tasks</span>
                                        <strong>{scopeOpenTaskIds.length}</strong>
                                    </div>
                                    <label className="scope-close-field">
                                        <span>Verschieben nach</span>
                                        <select
                                            value={scopeCompletionTargetId}
                                            onChange={(event) => setScopeCompletionTargetId(event.target.value)}
                                            disabled={scopeOpenTaskIds.length === 0}
                                        >
                                            <option value="">
                                                {scopeOpenTaskIds.length === 0 ? 'Keine offenen Tasks' : 'Scope auswählen'}
                                            </option>
                                            {scopeWindows
                                                .filter((scope) => scope.id !== activeScopeWindow.id)
                                                .map((scope) => (
                                                    <option key={scope.id} value={scope.id}>
                                                        {scope.name}
                                                    </option>
                                                ))}
                                        </select>
                                    </label>
                                </div>
                            </div>
                        </div>
                        <div className="panel-footer">
                            <div className="panel-actions">
                                <div className="panel-actions-right">
                                    <button className="btn btn-ghost btn-compact" onClick={() => setIsScopeCloseOpen(false)}>
                                        Close
                                    </button>
                                    <button
                                        className="btn btn-primary btn-compact"
                                        onClick={handleScopeClose}
                                        disabled={!canManageScopeById(activeScopeWindow.id)}
                                    >
                                        Abschließen
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
                            <button className="panel-close" onClick={closeKrComposer} aria-label="Close">
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
                                    <div className="member-select" data-member-dropdown="kr-assignees">
                                        <button
                                            type="button"
                                            className="member-select-trigger"
                                            onClick={() =>
                                                setOpenMemberDropdownId((prev) => (prev === 'kr-assignees' ? null : 'kr-assignees'))
                                            }
                                        >
                                            {krComposerDraft.assignees.length > 0
                                                ? krComposerDraft.assignees
                                                    .map((id) => getMemberLabel(activeTenantId, id))
                                                    .join(', ')
                                                : 'Select members'}
                                        </button>
                                        {openMemberDropdownId === 'kr-assignees' && (
                                            <div className="member-select-dropdown">
                                                {getMembersForTenant(activeTenantId).map((member) => {
                                                    const checked = krComposerDraft.assignees.includes(member.userId);
                                                    return (
                                                        <button
                                                            key={member.userId}
                                                            type="button"
                                                            className={`member-select-option${checked ? ' active' : ''}`}
                                                            onClick={() => {
                                                                const next = checked
                                                                    ? krComposerDraft.assignees.filter((id) => id !== member.userId)
                                                                    : krComposerDraft.assignees.concat(member.userId);
                                                                setKrComposerDraft((prev) => ({ ...prev, assignees: next }));
                                                            }}
                                                        >
                                                            {member.user?.name || member.user?.email || member.userId}
                                                        </button>
                                                    );
                                                })}
                                                {getMembersForTenant(activeTenantId).length === 0 && (
                                                    <div className="member-select-empty">No members in this huddle yet.</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                        </div>
                        <div className="panel-footer">
                            <div className="panel-actions">
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
                            <button className="panel-close" onClick={closeObjectiveSettings} aria-label="Close">×</button>
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
                                        <div className="member-select" data-member-dropdown="objective-owner-settings">
                                            <button
                                                type="button"
                                                className="member-select-trigger"
                                                onClick={() =>
                                                    setOpenMemberDropdownId((prev) =>
                                                        prev === 'objective-owner-settings' ? null : 'objective-owner-settings'
                                                    )
                                                }
                                            >
                                                {objectiveDraft.ownerId
                                                    ? getMemberLabel(activeTenantId, objectiveDraft.ownerId)
                                                    : 'Unassigned'}
                                            </button>
                                            {openMemberDropdownId === 'objective-owner-settings' && (
                                                <div className="member-select-dropdown">
                                                    <button
                                                        type="button"
                                                        className={`member-select-option${!objectiveDraft.ownerId ? ' active' : ''}`}
                                                        onClick={() => {
                                                            setObjectiveDraft((prev) => ({ ...prev, ownerId: '' }));
                                                            setOpenMemberDropdownId(null);
                                                        }}
                                                    >
                                                        Unassigned
                                                    </button>
                                                    {getMembersForTenant(activeTenantId).map((member) => (
                                                        <button
                                                            key={member.userId}
                                                            type="button"
                                                            className={`member-select-option${objectiveDraft.ownerId === member.userId ? ' active' : ''}`}
                                                            onClick={() => {
                                                                setObjectiveDraft((prev) => ({ ...prev, ownerId: member.userId }));
                                                                setOpenMemberDropdownId(null);
                                                            }}
                                                        >
                                                            {member.user?.name || member.user?.email || member.userId}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
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
                        </div>
                        <div className="panel-footer">
                            <div className="panel-actions">
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

                            {(isActiveHuddleOwner || isSuperAdmin) && (
                                <div className="panel-section">
                                    <div className="section-title">Rename huddle</div>
                                    {isPersonalActive ? (
                                        <div className="empty-state">Private huddles cannot be renamed.</div>
                                    ) : (
                                        <form className="inline-form" onSubmit={handleRenameHuddle}>
                                            <input
                                                type="text"
                                                placeholder="Huddle name"
                                                value={huddleRenameInput}
                                                onChange={(e) => setHuddleRenameInput(e.target.value)}
                                                required
                                            />
                                            <button className="btn btn-primary" type="submit" disabled={huddleRenameSaving}>
                                                {huddleRenameSaving ? 'Saving...' : 'Save'}
                                            </button>
                                        </form>
                                    )}
                                </div>
                            )}

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
                                <button className="panel-close" onClick={closeCreateTaskModal} aria-label="Close">
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
                                        onChange={(e) => {
                                            const nextHuddleId = e.target.value;
                                            setNewTaskHuddleId(nextHuddleId);
                                            setNewTaskScopeId(null);
                                        }}
                                    >
                                        {displayMemberships.map((membership) => (
                                            <option key={membership.id} value={membership.tenantId}>
                                                {getHuddleName(membership.tenant?.name) || membership.tenantId}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Scope</label>
                                    <select
                                        value={newTaskScopeId || ''}
                                        onChange={(e) => setNewTaskScopeId(e.target.value || null)}
                                    >
                                        <option value="">Ohne Scope</option>
                                        {getVisibleScopeWindowsForTenant(newTaskHuddleId)
                                            .filter((scope) => !scope.completionStatus)
                                            .map((scope) => (
                                                <option key={scope.id} value={scope.id}>
                                                    {scope.name} · {getScopeDateLabel(scope)}
                                                </option>
                                            ))}
                                    </select>
                                </div>
                                {!isPersonalTenant(newTaskHuddleId) && (
                                    <div className="form-group">
                                        <label>Owner</label>
                                        <div
                                            className="member-select"
                                            data-member-dropdown="new-task-owner"
                                        >
                                            <button
                                                type="button"
                                                className="member-select-trigger"
                                                onClick={() =>
                                                    setOpenMemberDropdownId((prev) => (prev === 'new-task-owner' ? null : 'new-task-owner'))
                                                }
                                            >
                                                {newTaskOwnerId
                                                    ? getMemberLabel(newTaskHuddleId, newTaskOwnerId)
                                                    : 'Unassigned'}
                                            </button>
                                            {openMemberDropdownId === 'new-task-owner' && (
                                                <div className="member-select-dropdown">
                                                    <button
                                                        type="button"
                                                        className={`member-select-option${!newTaskOwnerId ? ' active' : ''}`}
                                                        onClick={() => {
                                                            setNewTaskOwnerId(null);
                                                            setOpenMemberDropdownId(null);
                                                        }}
                                                    >
                                                        Unassigned
                                                    </button>
                                                    {getMembersForTenant(newTaskHuddleId).map((member) => (
                                                        <button
                                                            key={member.userId}
                                                            type="button"
                                                            className={`member-select-option${newTaskOwnerId === member.userId ? ' active' : ''}`}
                                                            onClick={() => {
                                                                setNewTaskOwnerId(member.userId);
                                                                setOpenMemberDropdownId(null);
                                                            }}
                                                        >
                                                            {member.user?.name || member.user?.email || member.userId}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                                {!isPersonalTenant(newTaskHuddleId) && (
                                    <div className="form-group">
                                        <label>Members</label>
                                        <div
                                            className="member-select"
                                            data-member-dropdown="new-task-assignees"
                                        >
                                            <button
                                                type="button"
                                                className="member-select-trigger"
                                                onClick={() =>
                                                    setOpenMemberDropdownId((prev) =>
                                                        prev === 'new-task-assignees' ? null : 'new-task-assignees'
                                                    )
                                                }
                                            >
                                                {newTaskAssignees.length > 0
                                                    ? newTaskAssignees
                                                        .map((id) => getMemberLabel(newTaskHuddleId, id))
                                                        .join(', ')
                                                    : 'Select members'}
                                            </button>
                                            {openMemberDropdownId === 'new-task-assignees' && (
                                                <div className="member-select-dropdown">
                                                    {getMembersForTenant(newTaskHuddleId).map((member) => {
                                                        const checked = newTaskAssignees.includes(member.userId);
                                                        return (
                                                            <button
                                                                key={member.userId}
                                                                type="button"
                                                                className={`member-select-option${checked ? ' active' : ''}`}
                                                                onClick={() => {
                                                                    const next = checked
                                                                        ? newTaskAssignees.filter((id) => id !== member.userId)
                                                                        : newTaskAssignees.concat(member.userId);
                                                                    setNewTaskAssignees(next);
                                                                }}
                                                            >
                                                                {member.user?.name || member.user?.email || member.userId}
                                                            </button>
                                                        );
                                                    })}
                                                    {getMembersForTenant(newTaskHuddleId).length === 0 && (
                                                        <div className="member-select-empty">No members in this huddle yet.</div>
                                                    )}
                                                </div>
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
                            </div>
                            <div style={{ position: 'sticky', bottom: 0, background: 'var(--bg-secondary)', padding: '0.75rem 1.5rem 1.25rem', borderTop: '1px solid var(--border-color)', marginTop: '2rem' }}>
                                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                    <button type="submit" className="btn btn-save" aria-label="Speichern">
                                        <span className="btn-save-icon" aria-hidden="true">
                                            <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
                                                <path d="M4 4h12l4 4v12H4z" />
                                                <path d="M7 4v6h8V4" />
                                                <path d="M7 14h10v6H7z" />
                                            </svg>
                                        </span>
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {inboxCaptureOpen && (
                <div className="modal-overlay" onClick={() => {
                    setInboxCaptureOpen(false);
                    setInboxEditId(null);
                }}>
                    <div
                        className="modal-content settings-modal"
                        onClick={(event) => event.stopPropagation()}
                        style={{ maxWidth: '560px', padding: 0 }}
                    >
                        <div className="panel-header">
                            <div>
                                <div className="panel-title">Capture inbox item</div>
                                <div className="panel-subtitle">Add incoming work before sorting.</div>
                            </div>
                            <button className="panel-close" onClick={() => {
                                setInboxCaptureOpen(false);
                                setInboxEditId(null);
                            }} aria-label="Close">
                                ×
                            </button>
                        </div>
                        <div className="panel-body">
                                <div className="panel-section">
                                    <label>
                                        Title
                                        <input
                                            type="text"
                                            value={inboxDraft.title}
                                            onChange={(event) => setInboxDraft((prev) => ({ ...prev, title: event.target.value }))}
                                            placeholder="New incoming item"
                                        />
                                    </label>
                                    <label>
                                        {t('inbox.field.description', 'Beschreibung')}
                                        <textarea
                                            rows={2}
                                            value={inboxDraft.description}
                                            placeholder={t('inbox.field.descriptionPlaceholder', 'Kurz beschreiben, worum es geht')}
                                            onChange={(event) => setInboxDraft((prev) => ({ ...prev, description: event.target.value }))}
                                        />
                                    </label>
                                    <div className="inbox-dropdown-row">
                                        <label>
                                            {t('inbox.field.source', 'Source')}
                                            <div className="filter-dropdown" ref={inboxSourceRef}>
                                                <button
                                                    type="button"
                                                    className="filter-select"
                                                    onClick={() => {
                                                        setInboxSourceOpen((prev) => !prev);
                                                        setInboxActionOpen(false);
                                                        setInboxPriorityOpen(false);
                                                    }}
                                                    aria-expanded={inboxSourceOpen}
                                                >
                                                    {inboxDraft.source ? getSourceLabel(inboxDraft.source) : t('inbox.field.selectSource', 'Select source')}
                                                </button>
                                                {inboxSourceOpen && (
                                                    <div className="filter-options" role="listbox">
                                                        {INBOX_SOURCE_OPTIONS.map((source) => (
                                                            <button
                                                                key={source.value}
                                                                type="button"
                                                                className={`filter-option ${inboxDraft.source === source.value ? 'active' : ''}`}
                                                                onClick={() => {
                                                                    setInboxDraft((prev) => ({ ...prev, source: source.value }));
                                                                    setInboxSourceOpen(false);
                                                                }}
                                                            >
                                                                {t(source.labelId, source.defaultMessage)}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </label>
                                        <label>
                                            {t('inbox.field.action', 'Suggested action')}
                                            <div className="filter-dropdown" ref={inboxActionRef}>
                                                <button
                                                    type="button"
                                                    className="filter-select"
                                                    onClick={() => {
                                                        setInboxActionOpen((prev) => !prev);
                                                        setInboxSourceOpen(false);
                                                        setInboxPriorityOpen(false);
                                                    }}
                                                    aria-expanded={inboxActionOpen}
                                                >
                                                    {inboxDraft.suggestedAction
                                                        ? getActionLabel(inboxDraft.suggestedAction)
                                                        : t('inbox.field.selectAction', 'Select action')}
                                                </button>
                                                {inboxActionOpen && (
                                                    <div className="filter-options" role="listbox">
                                                        {INBOX_ACTION_OPTIONS.map((action) => (
                                                            <button
                                                                key={action.value}
                                                                type="button"
                                                                className={`filter-option ${inboxDraft.suggestedAction === action.value ? 'active' : ''}`}
                                                                onClick={() => {
                                                                    setInboxDraft((prev) => ({ ...prev, suggestedAction: action.value }));
                                                                    setInboxActionOpen(false);
                                                                }}
                                                            >
                                                                {t(action.labelId, action.defaultMessage)}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </label>
                                        <label>
                                            {t('task.field.priority', 'Priority')}
                                            <div className="filter-dropdown" ref={inboxPriorityRef}>
                                                <button
                                                    type="button"
                                                    className="filter-select"
                                                    onClick={() => {
                                                        setInboxActionOpen(false);
                                                        setInboxSourceOpen(false);
                                                        setInboxPriorityOpen((prev) => !prev);
                                                    }}
                                                    aria-expanded={inboxPriorityOpen}
                                                >
                                                    {inboxDraft.priority
                                                        ? getPriorityLabel(inboxDraft.priority)
                                                        : t('task.field.selectPriority', 'Priority wählen')}
                                                </button>
                                                {inboxPriorityOpen && (
                                                    <div className="filter-options" role="listbox">
                                                        {INBOX_PRIORITY_OPTIONS.map((priority) => (
                                                            <button
                                                                key={priority.value}
                                                                type="button"
                                                                className={`filter-option ${inboxDraft.priority === priority.value ? 'active' : ''}`}
                                                                onClick={() => {
                                                                    setInboxDraft((prev) => ({ ...prev, priority: priority.value }));
                                                                    setInboxPriorityOpen(false);
                                                                }}
                                                            >
                                                                {t(priority.labelId, priority.defaultMessage)}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </label>
                                    </div>
                                </div>
                        </div>
                        <div className="panel-footer">
                            <div className="panel-actions">
                                <div className="panel-actions-right">
                                    <button
                                        className="btn btn-save btn-compact tooltip-target"
                                        data-tooltip="Speichern"
                                        aria-label="Speichern"
                                        onClick={() => {
                                            if (!inboxDraft.title.trim()) return;
                                        const now = new Date().toISOString();
                                        const creatorInfo = getMemberInfo(activeTenantId, currentUserId || session?.user?.id || undefined);
                                        if (inboxEditId) {
                                            persistInboxItems((prev) =>
                                                prev.map((item) =>
                                                    item.id === inboxEditId
                                                        ? {
                                                            ...item,
                                                            title: inboxDraft.title.trim(),
                                                            source: inboxDraft.source || undefined,
                                                            suggestedAction: inboxDraft.suggestedAction || undefined,
                                                            description: inboxDraft.description.trim() || undefined,
                                                            priority: (inboxDraft.priority as TaskView['priority']) || 'MEDIUM',
                                                        }
                                                        : item
                                                )
                                            );
                                        } else {
                                            persistInboxItems((prev) => [
                                                {
                                                    id: `inbox-${now}-${Math.random().toString(36).slice(2, 7)}`,
                                                    title: inboxDraft.title.trim(),
                                                    source: inboxDraft.source || undefined,
                                                    suggestedAction: inboxDraft.suggestedAction || undefined,
                                                    description: inboxDraft.description.trim() || undefined,
                                                    priority: (inboxDraft.priority as TaskView['priority']) || 'MEDIUM',
                                                    createdAt: now,
                                                    kind: 'Incoming',
                                                    creatorLabel: creatorInfo.label,
                                                    creatorAvatarUrl: undefined,
                                                    creatorId: currentUserId || session?.user?.id || undefined,
                                                    tenantId: activeTenantId || null
                                                },
                                                ...prev
                                            ]);
                                        }
                                            setInboxDraft({ title: '', source: '', suggestedAction: '', description: '', priority: 'MEDIUM' });
                                            setInboxCaptureOpen(false);
                                            setInboxEditId(null);
                                        }}
                                    >
                                        <span className="btn-save-icon">{saveIcon}</span>
                                    </button>
                                </div>
                            </div>
                        </div>
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
                                <button className="panel-close" onClick={closeDetailsModal} aria-label="Close">
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
                                {selectedTask.sourceType === 'MANUAL' && !isScopeReadOnly && (
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
                                <button className="btn btn-secondary" onClick={closeDetailsModal}>
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
                                <button className="panel-close" onClick={closeEditTaskModal} aria-label="Close">
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
                                        onChange={(e) => {
                                            setEditTaskHuddleId(e.target.value);
                                            setEditTaskScopeId(null);
                                            setEditTaskScopeOriginal(null);
                                        }}
                                    >
                                        {displayMemberships.map((membership) => (
                                            <option key={membership.id} value={membership.tenantId}>
                                                {getHuddleName(membership.tenant?.name) || membership.tenantId}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                {view === 'scope' && (
                                    <div className="form-group">
                                        <label>Scope</label>
                                        <select
                                            value={editTaskScopeId || ''}
                                            onChange={(e) => setEditTaskScopeId(e.target.value || null)}
                                        >
                                            <option value="">Ohne Scope</option>
                                            {scopeWindows
                                                .filter((scope) => !scope.completionStatus)
                                                .map((scope) => (
                                                    <option key={scope.id} value={scope.id}>
                                                        {scope.name} · {getScopeDateLabel(scope)}
                                                    </option>
                                                ))}
                                        </select>
                                    </div>
                                )}
                                {!isPersonalTenant(editTaskHuddleId) && (
                                    <div className="form-group">
                                        <label>Owner</label>
                                        <div className="member-select" data-member-dropdown="edit-task-owner">
                                            <button
                                                type="button"
                                                className="member-select-trigger"
                                                onClick={() =>
                                                    setOpenMemberDropdownId((prev) =>
                                                        prev === 'edit-task-owner' ? null : 'edit-task-owner'
                                                    )
                                                }
                                            >
                                                {editTaskOwnerId
                                                    ? getMemberLabel(editTaskHuddleId, editTaskOwnerId)
                                                    : 'Unassigned'}
                                            </button>
                                            {openMemberDropdownId === 'edit-task-owner' && (
                                                <div className="member-select-dropdown">
                                                    <button
                                                        type="button"
                                                        className={`member-select-option${!editTaskOwnerId ? ' active' : ''}`}
                                                        onClick={() => {
                                                            setEditTaskOwnerId(null);
                                                            setOpenMemberDropdownId(null);
                                                        }}
                                                    >
                                                        Unassigned
                                                    </button>
                                                    {getMembersForTenant(editTaskHuddleId).map((member) => (
                                                        <button
                                                            key={member.userId}
                                                            type="button"
                                                            className={`member-select-option${editTaskOwnerId === member.userId ? ' active' : ''}`}
                                                            onClick={() => {
                                                                setEditTaskOwnerId(member.userId);
                                                                setOpenMemberDropdownId(null);
                                                            }}
                                                        >
                                                            {member.user?.name || member.user?.email || member.userId}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                                {!isPersonalTenant(editTaskHuddleId) && (
                                    <div className="form-group">
                                        <label>Members</label>
                                        <div className="member-select" data-member-dropdown="edit-task-assignees">
                                            <button
                                                type="button"
                                                className="member-select-trigger"
                                                onClick={() =>
                                                    setOpenMemberDropdownId((prev) =>
                                                        prev === 'edit-task-assignees' ? null : 'edit-task-assignees'
                                                    )
                                                }
                                            >
                                                {editTaskAssignees.length > 0
                                                    ? editTaskAssignees
                                                        .map((id) => getMemberLabel(editTaskHuddleId, id))
                                                        .join(', ')
                                                    : 'Select members'}
                                            </button>
                                            {openMemberDropdownId === 'edit-task-assignees' && (
                                                <div className="member-select-dropdown">
                                                    {getMembersForTenant(editTaskHuddleId).map((member) => {
                                                        const checked = editTaskAssignees.includes(member.userId);
                                                        return (
                                                            <button
                                                                key={member.userId}
                                                                type="button"
                                                                className={`member-select-option${checked ? ' active' : ''}`}
                                                                onClick={() => {
                                                                    const next = checked
                                                                        ? editTaskAssignees.filter((id) => id !== member.userId)
                                                                        : editTaskAssignees.concat(member.userId);
                                                                    setEditTaskAssignees(next);
                                                                }}
                                                            >
                                                                {member.user?.name || member.user?.email || member.userId}
                                                            </button>
                                                        );
                                                    })}
                                                    {getMembersForTenant(editTaskHuddleId).length === 0 && (
                                                        <div className="member-select-empty">No members in this huddle yet.</div>
                                                    )}
                                                </div>
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
