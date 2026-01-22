import React, { useState, useEffect, useRef, useMemo } from 'react';
import { TaskView, BoardView, TaskStatus } from '@kanbax/domain';
import { supabase } from './supabaseClient';

const API_BASE = 'http://localhost:4000';

const App: React.FC = () => {
    const [view, setView] = useState<'kanban' | 'list' | 'table' | 'archived' | 'settings'>('kanban');
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
    const [searchLoading, setSearchLoading] = useState(false);
    const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const pollInFlightRef = useRef(false);
    const searchDebounceRef = useRef<number | null>(null);
    const lastDragTargetRef = useRef<string | null>(null);
    const pollIntervalRef = useRef<number | null>(null);
    const dragStartTimeRef = useRef<number>(0);
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [tasks, setTasks] = useState<TaskView[]>([]);
    const [board, setBoard] = useState<BoardView | null>(null);
    const [filterText, setFilterText] = useState('');
    const [filterPriority, setFilterPriority] = useState('ALL');
    const [filterFavorites, setFilterFavorites] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'MEDIUM', dueDate: '' });
    const [newTaskAttachments, setNewTaskAttachments] = useState<TaskView['attachments']>([]);
    const [newTaskKinds, setNewTaskKinds] = useState<string[]>([]);
    const [newKindInput, setNewKindInput] = useState('');
    const [newTaskHuddleId, setNewTaskHuddleId] = useState<string | null>(null);
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
        return headers;
    };

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => setSession(data.session));
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
            setSession(nextSession);
        });
        return () => subscription.unsubscribe();
    }, []);

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
            const [tasksRes, boardsRes] = await Promise.all([
                fetch(`${API_BASE}/tasks`, { headers: getApiHeaders() }),
                fetch(`${API_BASE}/boards`, { headers: getApiHeaders() })
            ]);

            if (!tasksRes.ok || !boardsRes.ok) throw new Error('Failed to fetch data');

            const tasksData = await tasksRes.json();
            const boardsData = await boardsRes.json();

            setTasks(tasksData);
            if (activeTenantId) {
                setTasksByTenant((prev) => ({ ...prev, [activeTenantId]: tasksData }));
            }
            setBoard(boardsData[0] || null);
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

    useEffect(() => {
        if (session && activeTenantId) {
            fetchData();
        }
    }, [session, activeTenantId]);

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
        const allowedIds = new Set(getMembersForTenant(newTaskHuddleId).map((member) => member.userId));
        if (newTaskOwnerId && !allowedIds.has(newTaskOwnerId)) {
            setNewTaskOwnerId(null);
        }
        if (newTaskAssignees.length > 0) {
            setNewTaskAssignees(newTaskAssignees.filter((id) => allowedIds.has(id)));
        }
    }, [newTaskHuddleId, huddleMembersByTenant]);

    useEffect(() => {
        if (!editTaskHuddleId) return;
        const allowedIds = new Set(getMembersForTenant(editTaskHuddleId).map((member) => member.userId));
        if (editTaskOwnerId && !allowedIds.has(editTaskOwnerId)) {
            setEditTaskOwnerId(null);
        }
        if (editTaskAssignees.length > 0) {
            setEditTaskAssignees(editTaskAssignees.filter((id) => allowedIds.has(id)));
        }
    }, [editTaskHuddleId, huddleMembersByTenant]);

    useEffect(() => {
        if (isModalOpen && newDescriptionRef.current) {
            newDescriptionRef.current.innerHTML = newTask.description || '';
        }
    }, [isModalOpen, newTask.description]);

    useEffect(() => {
        if (isEditModalOpen && editDescriptionRef.current) {
            editDescriptionRef.current.innerHTML = editTask.description || '';
        }
    }, [isEditModalOpen, editTask.description]);

    const selectedTask = selectedTaskId ? tasks.find((task) => task.id === selectedTaskId) ?? null : null;
    const taskById = new Map(tasks.map((task) => [task.id, task]));
    const currentUserLabel = String(userProfile?.email || session?.user?.email || 'U');
    const currentUserInitial = currentUserLabel.charAt(0).toUpperCase() || 'U';
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

    const normalizedFilter = filterText.trim().toLowerCase();
    const matchesFilter = (task: TaskView) => {
        if (filterFavorites && !task.isFavorite) return false;
        if (filterPriority !== 'ALL' && task.priority !== filterPriority) return false;
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
    const visibleTasksForView = view === 'archived'
        ? filteredTasks.filter((task) => task.status === TaskStatus.ARCHIVED)
        : filteredTasks.filter((task) => task.status !== TaskStatus.ARCHIVED);
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
    const searchColumns = normalizedSearch && board?.columns
        ? board.columns.filter((column: any) => String(column.status).toLowerCase().includes(normalizedSearch))
        : [];
    const searchCacheComplete = displayMemberships.length > 0
        && displayMemberships.every((membership) => Boolean(tasksByTenant[membership.tenantId]));
    const getOrderKey = (tenantId: string | null | undefined, status: TaskStatus) =>
        `${tenantId || 'unknown'}:${status}`;
    const persistOrder = (tenantId: string | null | undefined, orders: Record<string, string[]>) => {
        if (!tenantId) return;
        try {
            localStorage.setItem(`kanbax-task-order:${tenantId}`, JSON.stringify(orders));
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
        if (!activeTenantId) return;
        try {
            const stored = localStorage.getItem(`kanbax-task-order:${activeTenantId}`);
            if (stored) {
                const parsed = JSON.parse(stored) as Record<string, string[]>;
                setTaskOrderByColumn(parsed);
            } else {
                setTaskOrderByColumn({});
            }
        } catch {
            setTaskOrderByColumn({});
        }
    }, [activeTenantId]);

    useEffect(() => {
        if (!activeTenantId || tasks.length === 0) return;
        const nextOrders: Record<string, string[]> = { ...taskOrderByColumn };
        const statuses = Array.from(new Set(tasks.map((task) => task.status)));
        statuses.forEach((status) => {
            const key = getOrderKey(activeTenantId, status);
            const existing = nextOrders[key] || [];
            const idsInStatus = tasks.filter((task) => task.status === status).map((task) => task.id);
            const ordered = existing.filter((id) => idsInStatus.includes(id));
            const missing = idsInStatus.filter((id) => !ordered.includes(id));
            nextOrders[key] = ordered.concat(missing);
        });
        setTaskOrderByColumn(nextOrders);
        persistOrder(activeTenantId, nextOrders);
    }, [activeTenantId, tasks]);
    const activeTasks = tasks.filter((task) => task.status !== TaskStatus.ARCHIVED);

    const handleCreateTask = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
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
                    ownerId: newTaskOwnerId || undefined,
                    assignees: newTaskAssignees,
                    boardId: 'default-board',
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

            setIsEditModalOpen(false);
            setEditingTaskId(null);
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
        setDraggingTaskId(null);
        lastDragTargetRef.current = null;
        setTimeout(() => setIsDragging(false), 200);
    };

    const onDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        e.currentTarget.classList.add('drag-over');
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

        const key = getOrderKey(activeTenantId, status);
        if (sourceStatus && sourceStatus !== status) {
            handleUpdateStatus(taskId, status);
        }

        const hasCardTarget = lastDragTargetRef.current?.startsWith(`${status}:`);
        lastDragTargetRef.current = null;
        if (hasCardTarget) {
            return;
        }

        setTaskOrderByColumn((prev) => {
            const next = { ...prev };
            const list = (next[key] || []).filter((id) => id !== taskId);
            next[key] = list.concat(taskId);
            persistOrder(activeTenantId, next);
            return next;
        });
    };

    const moveTaskOrder = (tenantId: string, status: TaskStatus, taskId: string, targetId: string | null) => {
        const key = getOrderKey(tenantId, status);
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
            persistOrder(tenantId, next);
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
        moveTaskOrder(activeTenantId, status, draggingTaskId, targetId);
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
        <div className="dashboard">
            <datalist id="kind-suggestions">
                {knownKinds.map((kind) => (
                    <option key={kind} value={kind} />
                ))}
            </datalist>
            <header className="topbar">
                <div className="topbar-inner">
                    <div className="topbar-search">
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
                            className={`icon-btn ${view === 'settings' ? 'active' : ''}`}
                            onClick={() => setView('settings')}
                            title="Settings"
                            aria-label="Settings"
                        >
                            <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
                                <path d="M12 2l1.5 3.5 3.7.6-2.6 2.5.7 3.7-3.3-1.8-3.3 1.8.7-3.7-2.6-2.5 3.7-.6L12 2z" />
                                <circle cx="12" cy="12" r="3.2" />
                            </svg>
                        </button>
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
                        {view !== 'settings' && (
                            <button
                                className="btn btn-primary"
                                disabled={!activeTenantId}
                                onClick={() => {
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
                                    setNewTaskHuddleId(activeTenantId || displayMemberships[0]?.tenantId || null);
                                    setNewTaskOwnerId(userProfile?.id || null);
                                    setNewTaskAssignees([]);
                                    setSelectedTemplateId('');
                                    setIsModalOpen(true);
                                }}
                            >
                                + Create Task
                            </button>
                        )}
                    </div>
                </div>
            </header>
            <aside className="sidebar">
                <h2 style={{ marginBottom: '2rem', color: 'var(--accent-primary)' }}>Kanbax</h2>
                <div className="sidebar-team">
                    <div className="sidebar-label-row">
                        <div className="sidebar-label">Huddles</div>
                        {hasSharedHuddles && (
                            <button
                                className="icon-btn sidebar-manage"
                                onClick={() => setIsTeamModalOpen(true)}
                                title="Manage huddles"
                                aria-label="Manage huddles"
                            >
                                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
                                    <path d="M12 15l-3.5 3.5" />
                                    <path d="M16.5 6.5l1 1a2.1 2.1 0 0 1 0 3l-7.5 7.5-4 1 1-4 7.5-7.5a2.1 2.1 0 0 1 3 0z" />
                                </svg>
                            </button>
                        )}
                    </div>
                    <div className="huddle-list">
                        {displayMemberships.map((membership) => {
                            const isActive = membership.tenantId === activeTenantId;
                            return (
                                <button
                                    key={membership.id}
                                    className={`huddle-item ${isActive ? 'active' : ''}`}
                                    onClick={() => {
                                        updateActiveTenant(membership.tenantId);
                                        setView('kanban');
                                    }}
                                >
                                    <span
                                        className="huddle-item-dot"
                                        style={{ background: getHuddleAccent(membership.tenantId, membership.tenant?.name).solid }}
                                    />
                                    <span className="huddle-item-name">
                                        {getHuddleName(membership.tenant?.name) || membership.tenantId}
                                    </span>
                                    {membership.tenant?.name?.toLowerCase() === 'personal' && (
                                        <span className="huddle-item-tag">Private</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="sidebar-user">
                    <div className="sidebar-label">Signed in as</div>
                    <div className="sidebar-user-email">{currentUserLabel}</div>
                    <button className="btn btn-ghost btn-compact" onClick={handleSignOut}>
                        Sign out
                    </button>
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
                    <h1>{view === 'settings' ? 'Settings' : (activeHuddleName || 'Huddle')}</h1>
                </div>
                {view === 'settings' ? (
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
                ) : (
                    <>
                        <div className="filter-bar">
                            <div className="view-switch" role="tablist" aria-label="View switcher">
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
                                <button
                                    className={`view-pill ${view === 'list' ? 'active' : ''}`}
                                    onClick={() => setView('list')}
                                    role="tab"
                                    aria-selected={view === 'list'}
                                >
                                    List
                                </button>
                            </div>
                            <div className="filter-actions">
                                <select
                                    value={filterPriority}
                                    onChange={(e) => setFilterPriority(e.target.value)}
                                    className="filter-select"
                                >
                                    <option value="ALL">All priorities</option>
                                    <option value="LOW">Low</option>
                                    <option value="MEDIUM">Medium</option>
                                    <option value="HIGH">High</option>
                                    <option value="CRITICAL">Critical</option>
                                </select>
                                <label className={`filter-checkbox ${filterFavorites ? 'active' : ''}`}>
                                    <input
                                        type="checkbox"
                                        checked={filterFavorites}
                                        onChange={(e) => setFilterFavorites(e.target.checked)}
                                    />
                                    <span>Favorites only</span>
                                </label>
                            </div>
                        </div>

                        {error && <div style={{ color: '#f87171', marginBottom: '1rem' }}>Error: {error}</div>}

                        {view === 'kanban' ? (
                            <div className="kanban-board">
                                {board?.columns.map((column: any) => {
                                    const visibleTasks = column.tasks.filter(matchesFilter);
                                    const orderKey = getOrderKey(activeTenantId, column.status);
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
                                        {displayTasks.map((task: TaskView) => {
                                            const checklistDone = task.checklist.filter((item) => item.done).length;
                                            const checklistTotal = task.checklist.length;
                                            const linkedCount = task.linkedTaskIds.length;
                                            const isChecklistComplete = checklistTotal > 0 && checklistDone === checklistTotal;
                                            const isLinkedFromOther = linkedToSet.has(task.id);
                                            const isDraggable = task.sourceType ? task.sourceType === 'MANUAL' : true;
                                            const taskCardStyle: React.CSSProperties = {
                                                cursor: isDraggable ? 'grab' : 'default',
                                                userSelect: 'none',
                                                WebkitUserDrag: isDraggable ? 'element' : 'auto',
                                                pointerEvents: 'auto',
                                            };
                                            return (
                                                <React.Fragment key={task.id}>
                                                    <div
                                                        className={`task-card${isDraggable ? ' task-card-draggable' : ''}${draggingTaskId === task.id ? ' dragging' : ''}`}
                                                        style={taskCardStyle}
                                                        draggable={isDraggable}
                                                        onDragStart={(e) => (isDraggable ? onDragStart(e, task.id) : e.preventDefault())}
                                                        onDragEnd={onDragEnd}
                                                        onDragOver={(e) => onCardDragOver(e, column.status, task.id)}
                                                        onDragLeave={onCardDragLeave}
                                                        onClick={() => handleCardClick(task)}
                                                    >
                                                        <div className="task-card-content">
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
                                                                <span
                                                                    className={`priority-dot priority-${task.priority.toLowerCase()}`}
                                                                    title={`Priority: ${task.priority}`}
                                                                />
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
                                                                {task.assignees.length > 0 && renderAvatarStack(task.tenantId, task.assignees)}
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
                                );
                                })}
                            </div>
                        ) : view === 'archived' ? (
                            <div className="kanban-board">
                                <div className="kanban-column">
                                    <div className="column-header">
                                        <span>ARCHIVED</span>
                                        <span>{visibleTasksForView.length}</span>
                                    </div>
                                    {visibleTasksForView.map((task: TaskView) => {
                                        const checklistDone = task.checklist.filter((item) => item.done).length;
                                        const checklistTotal = task.checklist.length;
                                        const linkedCount = task.linkedTaskIds.length;
                                        const isLinkedFromOther = linkedToSet.has(task.id);
                                        return (
                                            <div
                                                key={task.id}
                                                className="task-card"
                                                onClick={() => openDetailsModal(task)}
                                            >
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
                                                    <span
                                                        className={`priority-dot priority-${task.priority.toLowerCase()}`}
                                                        aria-label={`Priority ${task.priority}`}
                                                        title={`Priority: ${task.priority}`}
                                                    />
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
                                                        <span className={`badge badge-priority-${task.priority.toLowerCase()}`}>
                                                            {task.priority}
                                                        </span>
                                                    </div>
                                                    <div className="task-card-people">
                                                        {task.ownerId && renderAvatarStack(task.tenantId, [task.ownerId])}
                                                        {task.assignees.length > 0 && renderAvatarStack(task.tenantId, task.assignees)}
                                                    </div>
                                                    <div className="task-card-icons">
                                                        {checklistTotal > 0 && (
                                                            <span className="icon-badge">
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
                                        );
                                    })}
                                </div>
                            </div>
                        ) : view === 'list' ? (
                            <div className="task-list">
                                {visibleTasksForView.map((task: TaskView) => {
                                    const checklistDone = task.checklist.filter((item) => item.done).length;
                                    const checklistTotal = task.checklist.length;
                                    const linkedCount = task.linkedTaskIds.length;
                                    const isChecklistComplete = checklistTotal > 0 && checklistDone === checklistTotal;
                                    const isLinkedFromOther = linkedToSet.has(task.id);
                                    return (
                                        <div
                                            key={task.id}
                                            className="task-row"
                                            onClick={() => openDetailsModal(task)}
                                        >
                                            <div className="task-row-main">
                                                <div className="task-row-title">
                                                    {isLinkedFromOther && (
                                                        <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" className="linked-icon">
                                                            <path d="M10 14a5 5 0 0 1 0-7l2-2a5 5 0 1 1 7 7l-1 1" />
                                                            <path d="M14 10a5 5 0 0 1 0 7l-2 2a5 5 0 1 1-7-7l1-1" />
                                                        </svg>
                                                    )}
                                                    {task.title}
                                                </div>
                                                <div className="task-row-meta">
                                                    {task.kinds.map((kind) => (
                                                        <span key={kind} className="badge task-kind-badge">
                                                            {kind}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="task-row-side">
                                                <span
                                                    className={`priority-dot priority-${task.priority.toLowerCase()}`}
                                                    aria-label={`Priority ${task.priority}`}
                                                    title={`Priority: ${task.priority}`}
                                                />
                                                <div className="task-card-people">
                                                    {task.ownerId && renderAvatarStack(task.tenantId, [task.ownerId])}
                                                    {task.assignees.length > 0 && renderAvatarStack(task.tenantId, task.assignees)}
                                                </div>
                                                <div className="task-row-icons">
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
                                    );
                                })}
                            </div>
                        ) : view === 'table' ? (
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
                                    {visibleTasksForView.map((task: TaskView) => (
                                        <tr
                                            key={task.id}
                                            onClick={() => openDetailsModal(task)}
                                        >
                                            <td>{task.title}</td>
                                            <td>
                                                <div className="task-card-people">
                                                    {task.ownerId && renderAvatarStack(task.tenantId, [task.ownerId])}
                                                    {task.assignees.length > 0 && renderAvatarStack(task.tenantId, task.assignees)}
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
                                                {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '—'}
                                            </td>
                                            <td>{task.sourceIndicator}</td>
                                            <td>
                                                {task.sourceType === 'MANUAL' && (
                                                    <button
                                                        className="delete-btn"
                                                        style={{ opacity: 1 }}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedTaskId(task.id);
                                                            setIsDetailsModalOpen(true);
                                                        }}
                                                    >
                                                        Delete
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
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

            {isTeamModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content team-modal">
                        <div className="panel-header">
                            <div>
                                <div className="panel-title">Huddle settings</div>
                                <div className="panel-subtitle">Manage huddles and members</div>
                            </div>
                            <button className="icon-btn" onClick={() => setIsTeamModalOpen(false)}>✕</button>
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
                            <button className="icon-btn" onClick={() => setIsInvitesModalOpen(false)}>✕</button>
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
                            <h2 style={{ marginBottom: 0 }}>Create New Task</h2>
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
                                    <button type="button" className="btn btn-secondary btn-compact" onClick={handleChecklistAdd}>
                                        Add
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
                                    <button type="button" className="btn btn-secondary btn-compact" onClick={handleAddLink}>
                                        Link
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
                                        }}
                                    >
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-primary">
                                        Create Task
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
                                            <button
                                                className="icon-btn"
                                                onClick={() => handleDeleteTask(selectedTask.id)}
                                                title="Delete"
                                                aria-label="Delete task"
                                            >
                                                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
                                                    <path d="M3 6h18" />
                                                    <path d="M8 6V4h8v2" />
                                                    <path d="M6 6l1 14h10l1-14" />
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
                                    <span className="detail-label">Status</span>
                                    <span className="detail-value">{selectedTask.status}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">Deadline</span>
                                    <span className="detail-value">
                                        {selectedTask.dueDate ? new Date(selectedTask.dueDate).toLocaleDateString() : '—'}
                                    </span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">Owner</span>
                                    <span className="detail-value">
                                        {selectedTask.ownerId
                                            ? renderAvatarStack(selectedTask.tenantId, [selectedTask.ownerId], 'avatar-stack-lg')
                                            : '—'}
                                    </span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">Members</span>
                                    <span className="detail-value">
                                        {selectedTask.assignees.length > 0
                                            ? renderAvatarStack(selectedTask.tenantId, selectedTask.assignees, 'avatar-stack-lg')
                                            : '—'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="detail-section">
                            <div className="detail-section-title">Description</div>
                            <div
                                className="detail-description rich-display"
                                dangerouslySetInnerHTML={{
                                    __html: selectedTask.description || 'No description provided.'
                                }}
                            />
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
                                <button type="button" className="btn btn-secondary btn-compact" onClick={handleAddLink}>
                                    Link
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
                                <button type="button" className="btn btn-secondary btn-compact" onClick={handleChecklistAdd}>
                                    Add
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
                                <button type="button" className="btn btn-primary btn-compact" onClick={handleAddComment}>
                                    Post
                                </button>
                            </div>
                            <div className="comment-list">
                                {selectedTask.comments && selectedTask.comments.length > 0 ? (
                                    selectedTask.comments.map((comment) => (
                                        <div key={comment.id} className="comment-card">
                                            <div className="comment-avatar comment-avatar-small">
                                                {String(comment.createdBy || 'U').charAt(0).toUpperCase() || 'U'}
                                            </div>
                                            <div className="comment-body">
                                                <div className="comment-meta">
                                                    <span className="comment-author">{comment.createdBy}</span>
                                                    <span className="comment-time">{new Date(comment.createdAt).toLocaleString()}</span>
                                                </div>
                                                <div className="comment-text">{comment.text}</div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="comment-empty">No comments yet.</div>
                                )}
                            </div>
                        </div>

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


                        <div className="detail-section">
                            <div className="detail-section-title">Activity</div>
                            <div className="activity-list">
                                {selectedTask.activityLog && selectedTask.activityLog.length > 0 ? (
                                    [...selectedTask.activityLog]
                                        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                                        .map((entry) => (
                                            <div key={entry.id} className="activity-item">
                                                <div className="activity-dot" />
                                                <div className="activity-body">
                                                    <div className="activity-text">{entry.message}</div>
                                                    <div className="activity-meta">
                                                        {entry.actorId} · {new Date(entry.timestamp).toLocaleString()}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                ) : (
                                    <div className="activity-empty">No activity yet.</div>
                                )}
                            </div>
                        </div>
                        </div>
                        <div style={{ position: 'sticky', bottom: 0, background: 'var(--bg-secondary)', padding: '0.75rem 1.5rem 1.25rem', borderTop: '1px solid var(--border-color)', marginTop: '2rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => {
                                        setIsDetailsModalOpen(false);
                                        setSelectedTaskId(null);
                                    }}
                                >
                                    Close
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
                            <h2 style={{ marginBottom: 0 }}>Edit Task</h2>
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
