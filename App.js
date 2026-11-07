import GroupChat from './components/GroupChat';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState, Modal, StatusBar, Keyboard, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Switch, Text, TextInput, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import * as Clipboard from 'expo-clipboard';
import { supabase, configurationError } from './lib/supabase';
import { createTaskRepository, databaseMessage } from './lib/tasks';
import { createGroupRepository } from './lib/groups';

const taskRepository = supabase ? createTaskRepository(supabase) : null;
const groupRepository = supabase ? createGroupRepository(supabase) : null;

const INK = '#414477';
const ACTION = ['#D97BC8', '#A18ADD', '#43C6D8'];

function GoogleMark() {
  return (
    <Svg width={23} height={23} viewBox="0 0 48 48" accessible={false}>
      <Path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3A12 12 0 1 1 32 14.7l5.7-5.7A20 20 0 1 0 44 24c0-1.2-.1-2.4-.4-3.5Z" />
      <Path fill="#FF3D00" d="m6.3 14.7 6.6 4.8A12 12 0 0 1 32 14.7l5.7-5.7A20 20 0 0 0 6.3 14.7Z" />
      <Path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.5-5.2l-6.2-5.2A12 12 0 0 1 12.7 28l-6.5 5A20 20 0 0 0 24 44Z" />
      <Path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4 5.6l6.2 5.2A19.9 19.9 0 0 0 44 24c0-1.2-.1-2.4-.4-3.5Z" />
    </Svg>
  );
}

function Field({ icon, label, inputRef, secret, ...props }) {
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.field, focused && styles.fieldFocused]}>
      <View style={styles.fieldIcon}><Ionicons name={icon} size={22} color={INK} /></View>
      <TextInput
        ref={inputRef}
        style={styles.input}
        placeholder={label}
        placeholderTextColor="#9599AF"
        accessibilityLabel={label}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry={secret && !visible}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...props}
      />
      {secret && (
        <Pressable
          onPress={() => setVisible(!visible)} hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={visible ? `Hide ${label}` : `Show ${label}`}
          style={styles.eye}
        >
          <Ionicons name={visible ? 'eye-outline' : 'eye-off-outline'} size={21} color={INK} />
        </Pressable>
      )}
    </View>
  );
}

function LoginPage({ initialError }) {
  const [tab, setTab] = useState('Login');
  const [identifier, setIdentifier] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState(initialError || configurationError);
  const [submitting, setSubmitting] = useState(false);
  const passwordRef = useRef(null);
  const confirmRef = useRef(null);
  const signup = tab === 'Sign Up';

  function changeTab(next) {
    setTab(next);
    setMessage('');
    setPassword('');
    setConfirm('');
  }

  async function submit() {
    if (submitting) return;
    Keyboard.dismiss();
    if (configurationError) { setMessage(configurationError); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier.trim()) || !password || (signup && !username.trim())) {
      setMessage('กรุณากรอกอีเมล รหัสผ่าน และชื่อให้ครบ'); return;
    }
    if (signup && password !== confirm) { setMessage('รหัสผ่านไม่ตรงกัน'); return; }
    setSubmitting(true); setMessage('');
    try {
      if (signup) {
        const { data, error: authError } = await supabase.auth.signUp({
          email: identifier.trim(), password,
          options: { data: { username: username.trim() } },
        });
        if (authError) throw authError;
        if (!data.session) setMessage('สมัครแล้ว กรุณาเปิดอีเมลเพื่อยืนยันบัญชี แล้วกลับมากด Login');
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: identifier.trim(), password });
        if (authError) throw authError;
      }
    } catch (authError) { setMessage(authError.message || 'เข้าสู่ระบบไม่สำเร็จ'); }
    finally { setSubmitting(false); }
  }

  return (
    <LinearGradient colors={['#FBFCFF', '#FDFBFF', '#FFFDEB']} style={styles.background}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.page}>
              <View style={styles.toolbar}>
                <Pressable style={styles.back} accessibilityLabel="Back to Login" accessibilityRole="button"
                  onPress={() => { Keyboard.dismiss(); changeTab('Login'); }}>
                  <Ionicons name="chevron-back" size={24} color="white" />
                </Pressable>
                <Pressable onPress={Keyboard.dismiss} hitSlop={12} accessibilityRole="button">
                  <Text style={styles.done}>Donee</Text>
                </Pressable>
              </View>

              <View style={styles.heading}>
                <Text style={styles.title}>{signup ? 'Create your account' : 'Welcome!'}</Text>
                <Text style={styles.subtitle}>{signup ? "Let's get you started!" : 'Sign in to continue'}</Text>
              </View>

              <View style={styles.panel}>
                <LinearGradient colors={['#A6E5EE', '#E9C2EA', '#FFF0A9']}
                  start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
                  style={styles.pastelBand} />

                <View style={styles.tabs} accessibilityRole="tablist">
                  {['Login', 'Sign Up'].map((item) => (
                    <Pressable key={item} onPress={() => changeTab(item)}
                      accessibilityRole="tab" accessibilityState={{ selected: tab === item }} style={styles.tab}>
                      {tab === item && <LinearGradient colors={['#DC91D2', '#BD88D6']}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} />}
                      <Text style={[styles.tabText, tab === item && styles.activeTab]}>{item}</Text>
                    </Pressable>
                  ))}
                </View>

                <View style={styles.card}>
                  {signup && <Field icon="person-outline" label="Username" value={username} onChangeText={setUsername} />}
                  <Field icon="mail-outline" label="Email"
                    value={identifier} onChangeText={setIdentifier} keyboardType="email-address"
                    textContentType="emailAddress" returnKeyType="next"
                    onSubmitEditing={() => passwordRef.current?.focus()} />
                  <Field key={tab} inputRef={passwordRef} icon="lock-closed-outline" label="Password" secret
                    value={password} onChangeText={setPassword} textContentType={signup ? 'newPassword' : 'password'}
                    returnKeyType={signup ? 'next' : 'done'}
                    onSubmitEditing={signup ? () => confirmRef.current?.focus() : submit} />
                  {signup && <Field inputRef={confirmRef} icon="lock-closed-outline" label="Confirm Password" secret
                    value={confirm} onChangeText={setConfirm} textContentType="newPassword" returnKeyType="done"
                    onSubmitEditing={submit} />}

                  {!!message && <Text accessibilityRole="alert" style={styles.error}>{message}</Text>}

                  <Pressable onPress={submit} disabled={submitting || !!configurationError} accessibilityRole="button" style={({ pressed }) => [styles.loginButton, pressed && styles.pressed]}>
                    <LinearGradient colors={ACTION} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.loginGradient}>
                      <Text style={styles.loginText}>{submitting ? 'กำลังเชื่อมต่อ…' : signup ? 'Sign Up' : 'Login'}</Text>
                    </LinearGradient>
                  </Pressable>

                  <View style={styles.divider}><View style={styles.line} /><Text style={styles.or}>or</Text><View style={styles.line} /></View>
                  <Pressable style={({ pressed }) => [styles.googleButton, pressed && styles.pressed]}
                    accessibilityRole="button" onPress={() => setMessage('ตอนนี้ใช้ Email / Password ก่อน Google Sign-in ยังไม่ได้ตั้งค่า')}>
                    <GoogleMark /><Text style={styles.googleText}>Continue with Google</Text>
                  </Pressable>

                  <View style={styles.footer}>
                    <Text style={styles.footerText}>{signup ? 'Already have an account?' : "Don’t have account?"}</Text>
                    <Pressable onPress={() => changeTab(signup ? 'Login' : 'Sign Up')} hitSlop={8} accessibilityRole="button">
                      <Text style={styles.footerLink}>{signup ? 'Login' : 'Sign up'}</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [starting, setStarting] = useState(true);
  const [sessionError, setSessionError] = useState('');
  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) setSessionError(error.message);
      setSession(data.session); setStarting(false);
    }).catch(error => { if (mounted) { setSessionError(error.message); setStarting(false); } });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) { setSession(nextSession); setStarting(false); }
    });
    const listener = AppState.addEventListener('change', state => {
      if (Platform.OS !== 'web') {
        if (state === 'active') supabase.auth.startAutoRefresh();
        else supabase.auth.stopAutoRefresh();
      }
    });
    return () => { mounted = false; subscription.unsubscribe(); listener.remove(); };
  }, []);
  return <SafeAreaProvider>{starting && supabase
    ? <SafeAreaView style={[styles.safe, { justifyContent: 'center', alignItems: 'center' }]}><Text>กำลังตรวจบัญชี…</Text></SafeAreaView>
    : session
      ? <HomePage key={session.user.id} user={session.user} />
      : <LoginPage initialError={sessionError} />}</SafeAreaProvider>;
}


const NAV_ITEMS = [
  ['Home', 'home-outline'], ['Tasks', 'reader-outline'],
  ['Groups', 'people-outline'], ['Calendar', 'calendar-outline'], ['Me', 'person-outline'],
];
const CATEGORIES = ['Study', 'Self Care', 'Personal', 'Group'];
const CATEGORY_COLORS = { Study: '#E9EEFF', 'Self Care': '#FBE5FC', Personal: '#FFF2D6', Group: '#E4F9F3' };
const PRIORITY_COLORS = { Low: '#D9FBEF', Medium: '#FFF3CE', High: '#FCE1F5' };
const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + 'T12:00:00');
  return !Number.isNaN(d.getTime()) && localDate(d) === value;
}
function distributeTasks(taskNames, memberNames, random = Math.random) {
  const shuffle = values => {
    const result = [...values];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  };
  if (!taskNames.length || !memberNames.length) return [];
  const people = shuffle(memberNames);
  return shuffle(taskNames).map((task, i) => ({ task, member: people[i % people.length] }));
}

function HomePage({ user }) {
  const [chatOpen, setChatOpen] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [groups, setGroups] = useState([]);
  const [profile, setProfile] = useState({ name: user.user_metadata?.username || user.email?.split('@')[0] || 'Member', email: user.email || '' });
  const [active, setActive] = useState('Home');
  const [filter, setFilter] = useState('Today');
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [groupTab, setGroupTab] = useState('My Groups');
  const [selectedDate, setSelectedDate] = useState(localDate());
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [sheet, setSheet] = useState(null);
  const [form, setForm] = useState({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [groupId, setGroupId] = useState(null);
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [results, setResults] = useState([]);
  const [reminders, setReminders] = useState(true);
  const [taskBusy, setTaskBusy] = useState(false);
  const [groupBusy, setGroupBusy] = useState(false);
  const [groupsState, setGroupsState] = useState('loading');
  const [databaseState, setDatabaseState] = useState('loading');
  const loadTasks = useCallback(async () => {
    try {
      setDatabaseState('loading');
      const { data: existing, error: profileError } = await supabase.from('profiles').select('id,username,email').eq('id', user.id).maybeSingle();
      if (profileError) throw profileError;
      if (!existing) {
        const { error: insertError } = await supabase.from('profiles').insert({
          id: user.id, username: user.user_metadata?.username || user.email?.split('@')[0], email: user.email,
        });
        if (insertError) {
          if (insertError.code !== '23505') throw insertError;
          const { data: concurrentProfile } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle();
          if (!concurrentProfile) throw insertError;
        }
      } else {
        setProfile({ name: existing.username || user.user_metadata?.username || 'Member', email: user.email || '' });
      }
      const rows = await taskRepository.list(user.id);
      setTasks(rows);
      setDatabaseState('ready');
    } catch (loadError) { setDatabaseState('error'); setNotice(databaseMessage(loadError)); }
  }, [user.id, user.email, user.user_metadata?.username]);
  const loadGroups = useCallback(async () => {
    try {
      setGroupsState('loading');
      const rows = await groupRepository.list();
      setGroups(rows); setGroupId(current => rows.some(group => group.id === current) ? current : rows[0]?.id || null);
      setGroupsState('ready');
      return rows;
    } catch (groupError) { setGroupsState('error'); setNotice(databaseMessage(groupError)); throw groupError; }
  }, []);
  const reloadAll = useCallback(async () => {
    await loadTasks();
    await loadGroups().catch(() => {});
  }, [loadTasks, loadGroups]);
  useEffect(() => { void Promise.resolve().then(reloadAll); }, [reloadAll]);
  useEffect(() => {
    // Refresh on foreground/focus plus a small polling interval for other members' changes.
    const interval = setInterval(() => { void reloadAll(); }, 20000);
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void reloadAll(); });
    return () => { clearInterval(interval); listener.remove(); };
  }, [reloadAll]);
  async function onLogout() {
    const { error: logoutError } = await supabase.auth.signOut();
    if (logoutError) setError(logoutError.message);
  }
  async function deleteTask() {
    if (taskBusy) return;
    setTaskBusy(true); setError('');
    try {
      if (form.persisted) await taskRepository.remove(form.id, user.id, form.group_id);
      setTasks(current => current.filter(task => task.id !== form.id));
      closeSheet(); setNotice('ลบงานแล้ว');
    } catch (deleteError) { setError(databaseMessage(deleteError)); }
    finally { setTaskBusy(false); }
  }

  const currentGroup = groups.find(g => g.id === groupId) || { id: null, name: 'เลือกหรือสร้างกลุ่ม', members: [], joined: false, icon: 'people-outline', invite_code: '' };
  const memberName = memberId => currentGroup.members.find(member => member.id === memberId)?.name || 'Member';
  const currentGroupTasks = tasks.filter(t => t.group_id === groupId);
  const pendingGroupTasks = currentGroupTasks.filter(t => !t.done);
  const personalTasks = tasks.filter(t => !t.group_id || t.assigned_to === user.id);
  const completed = personalTasks.filter(t => t.done).length;
  const updateForm = (key, value) => setForm(current => ({ ...current, [key]: value }));
  function navigate(page) { setActive(page); setNotice(''); }
  function openSheet(name, data = {}) { setForm(data); setError(''); setSheet(name); }
  function closeSheet() { setSheet(null); setError(''); }
  async function toggleTask(taskId) {
    if (taskBusy) return;
    const task = tasks.find(item => item.id === taskId);
    if (!task) return;
    setTaskBusy(true);
    try {
      const updated = await taskRepository.complete(task, user.id);
      setTasks(current => current.map(item => item.id === taskId ? updated : item));
      setNotice('อัปเดตสถานะแล้ว');
    } catch (updateError) { setNotice(databaseMessage(updateError)); }
    finally { setTaskBusy(false); }
  }
  function toggleChoice(setter, value) { setter(current => current.includes(value) ? current.filter(v => v !== value) : [...current, value]); }
  function openTask(task) {
    if (!task && ['Group Detail', 'Randomize'].includes(active) && !currentGroup.id) { setNotice('กรุณาสร้างหรือเข้าร่วมกลุ่มก่อน'); return; }
    openSheet('task', task || { title: '', date: active === 'Calendar' ? selectedDate : localDate(), time: '10:00', category: active === 'Group Detail' || active === 'Randomize' ? 'Group' : 'Study', priority: 'Medium', done: false, group_id: active === 'Group Detail' || active === 'Randomize' ? groupId : null });
  }
  async function saveTask() {
    if (taskBusy) return;
    if (!form.title?.trim()) return setError('Please enter a task name.');
    if (!validDate(form.date)) return setError('Use a valid date: YYYY-MM-DD.');
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(form.time)) return setError('Use a time from 00:00 to 23:59.');
    if (databaseState !== 'ready' || (form.group_id && groupsState !== 'ready')) return setError('กรุณารอให้โหลดข้อมูลสำเร็จก่อนบันทึกงาน');
    setTaskBusy(true); setError('');
    try {
      const task = await taskRepository.save(form, user.id);
      setTasks(current => form.id ? current.map(item => item.id === form.id ? task : item) : [task, ...current]);
      if (task.group_id && !task.done && !form.id) setSelectedTasks(current => [...current, task.id]);
      closeSheet(); setNotice('บันทึกงานแล้ว');
    } catch (saveError) { setError(databaseMessage(saveError)); }
    finally { setTaskBusy(false); }
  }
  function chooseGroup(nextId) {
    const group = groups.find(g => g.id === nextId);
    setGroupId(nextId); setSelectedTasks(tasks.filter(t => t.group_id === nextId && !t.done).map(t => t.id)); setSelectedMembers(group.members.map(member => member.id)); setResults([]); closeSheet();
  }
  function randomize() {
    if (!selectedTasks.length || !selectedMembers.length) { setNotice('Choose at least one task and one member.'); return; }
    const validTasks = pendingGroupTasks.filter(t => selectedTasks.includes(t.id));
    const validMembers = selectedMembers.filter(memberId => currentGroup.members.some(member => member.id === memberId));
    if (!validTasks.length || !validMembers.length) { setNotice('Choose pending tasks and members in this group.'); return; }
    setResults(distributeTasks(validTasks.map(t => t.id), validMembers).map(row => ({ ...row, task_id: row.task, task: validTasks.find(t => t.id === row.task).title, member_id: row.member, member: memberName(row.member) })));
    openSheet('result');
  }
  async function saveAssignment() {
    if (groupBusy || !currentGroup.id) return;
    setGroupBusy(true); setError('');
    try {
      await groupRepository.assign(currentGroup.id, results);
      closeSheet(); navigate('Group Detail');
      await reloadAll(); setNotice('บันทึกผู้รับผิดชอบแล้ว');
    } catch (assignmentError) { setError(databaseMessage(assignmentError)); }
    finally { setGroupBusy(false); }
  }
  async function saveGroup() {
    if (groupBusy) return;
    if (!form.name?.trim()) return setError('Please enter a group name.');
    setGroupBusy(true); setError('');
    try {
      const newId = await groupRepository.create(form.name);
      closeSheet(); setSelectedTasks([]); setSelectedMembers([user.id]);
      await loadGroups(); setGroupId(newId); navigate('Group Detail');
      setNotice('สร้างกลุ่มและรหัสเชิญแล้ว');
    } catch (createError) { setError(databaseMessage(createError)); }
    finally { setGroupBusy(false); }
  }
  async function joinByCode() {
    if (groupBusy) return;
    if (!form.invite_code?.trim()) return setError('Please enter an invite code.');
    setGroupBusy(true); setError('');
    try {
      const joined = await groupRepository.join(form.invite_code);
      closeSheet(); setSelectedTasks([]); setSelectedMembers([]);
      await loadGroups(); await loadTasks(); setGroupId(joined.id); navigate('Group Detail');
      setNotice(joined.alreadyJoined ? 'คุณเป็นสมาชิกกลุ่มนี้อยู่แล้ว' : 'เข้าร่วมกลุ่มสำเร็จ');
    } catch (joinError) { setError(databaseMessage(joinError)); }
    finally { setGroupBusy(false); }
  }
  async function copyInviteCode() {
    try {
      const copied = await Clipboard.setStringAsync(currentGroup.invite_code);
      setError(copied === false ? 'Could not copy. Press and hold the code to copy it.' : 'Invite code copied!');
    } catch {
      setError('Could not copy. Press and hold the code to copy it.');
    }
  }
  async function saveProfile() {
    if (!form.name?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email || '')) return setError('Enter your name and a valid email.');
    const name = form.name.trim();
    const { error: profileError } = await supabase.from('profiles').update({ username: name }).eq('id', user.id).select('id').single();
    if (profileError) { setError(databaseMessage(profileError)); return; }
    await loadGroups().catch(() => {});
    setProfile({ name, email: form.email.trim() }); closeSheet(); setNotice('Profile updated.');
  }
  const weekEnd = new Date(); weekEnd.setHours(12, 0, 0, 0); weekEnd.setDate(weekEnd.getDate() + ((7 - weekEnd.getDay()) % 7));
  const filteredTasks = personalTasks.filter(t =>
    (filter === 'All' || (filter === 'Today' ? t.date === localDate() : t.date >= localDate() && t.date <= localDate(weekEnd))) &&
    t.title.toLowerCase().includes(query.toLowerCase()) && (categoryFilter === 'All' || t.category === categoryFilter)
  ).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  function icon(name, size = 22, color = '#8CA3C8') { return <Ionicons name={name} size={size} color={color} />; }
  function section(title, target) {
    return <View style={hs.sectionHeader}><Text style={hs.sectionTitle}>{title}</Text>
      {target && <Pressable accessibilityRole="button" hitSlop={8} onPress={() => { if (target === 'Tasks') setFilter('All'); navigate(target); }} style={hs.inline}>
        <Text style={hs.muted}>see all</Text>{icon('chevron-forward', 15)}</Pressable>}</View>;
  }
  function chips(values, selected, onSelect, colors) {
    return <View style={hs.chips}>{values.map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: selected === value }}
      onPress={() => onSelect(value)} style={[hs.chip, { backgroundColor: colors?.[value] || '#F0ECFC' }, selected === value && hs.chipSelected]}>
      <Text style={[hs.chipText, selected === value && { color: '#7351C6' }]}>{value}</Text></Pressable>)}</View>;
  }
  function taskRows(list, detailed = false) {
    if (!list.length) return <View style={hs.empty}><Text style={hs.muted}>No tasks here yet.</Text><Pressable onPress={() => openTask()} accessibilityRole="button"><Text style={hs.link}>+ Add a task</Text></Pressable></View>;
    return list.map(task => <View key={task.id} style={hs.row}>
      <Pressable accessibilityRole="checkbox" accessibilityLabel={task.title} accessibilityState={{ checked: task.done }}
        disabled={taskBusy} onPress={() => toggleTask(task.id)} hitSlop={7} style={[hs.check, task.done && hs.checked]}>{task.done && icon('checkmark', 17, 'white')}</Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${task.title}`} onPress={() => openTask(task)} style={hs.taskBody}>
        <View style={hs.flex}><Text style={[hs.rowText, task.done && hs.strike]}>{task.title}</Text>
          {detailed && <View style={[hs.inline, { marginTop: 8 }]}><Text style={[hs.badge, { backgroundColor: CATEGORY_COLORS[task.category] }]}>{task.category}</Text><Text style={hs.small}>{task.time}{filter === 'All' ? ` · ${task.date.slice(5)}` : ''}</Text></View>}
        </View>{icon('chevron-forward', 18)}</Pressable>
    </View>);
  }
  function groupRows(list) {
    return list.length ? list.map(group => <Pressable key={group.id} style={hs.row} accessibilityRole="button" onPress={() => { setGroupId(group.id); navigate('Group Detail'); }}>
      <View style={hs.circle}>{icon(group.icon, 23, '#8654D9')}</View><View style={hs.flex}><Text style={hs.rowText}>{group.name}</Text><Text style={hs.small}>{group.members.length} members</Text></View>{icon('chevron-forward', 18)}</Pressable>)
      : <View style={hs.empty}><Text style={hs.muted}>No groups to show.</Text></View>;
  }
  function gradientButton(label, onPress, disabled = false) {
    return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={{ opacity: disabled ? 0.45 : 1 }}>
      <LinearGradient colors={ACTION} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={hs.primary}><Text style={hs.primaryText}>{label}</Text></LinearGradient></Pressable>;
  }
  function addButton() { return <Pressable accessibilityRole="button" accessibilityLabel="Add task" onPress={() => openTask()}>
    <LinearGradient colors={['#F9BCE9', '#FFF1B9', '#A3E7F5']} start={{ x: 0.3, y: 0 }} end={{ x: 0.8, y: 1 }} style={hs.add}>{icon('add', 33, '#6561BD')}</LinearGradient></Pressable>; }
  function textInput(label, key, placeholder, extra = {}) {
    return <View style={{ marginTop: 13 }}><Text style={hs.inputLabel}>{label}</Text><TextInput accessibilityLabel={label} value={form[key] || ''}
      onChangeText={text => updateForm(key, text)} placeholder={placeholder} placeholderTextColor="#A0AEC6" style={hs.input} {...extra} /></View>;
  }
  function renderCalendar() {
    const year = month.getFullYear(), m = month.getMonth();
    const offset = (new Date(year, m, 1).getDay() + 6) % 7;
    const count = new Date(year, m + 1, 0).getDate();
    return <>
      <View style={hs.monthHeader}>
        <Pressable accessibilityRole="button" accessibilityLabel="Previous month" hitSlop={12} onPress={() => setMonth(new Date(year, m - 1, 1))}>{icon('chevron-back', 20)}</Pressable>
        <Text style={hs.sectionTitle}>{month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Next month" hitSlop={12} onPress={() => setMonth(new Date(year, m + 1, 1))}>{icon('chevron-forward', 20)}</Pressable>
      </View>
      <View style={hs.calendarGrid}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <View key={'head' + i} style={hs.day}><Text style={hs.small}>{d}</Text></View>)}
        {Array.from({ length: offset }, (_, i) => <View key={'blank' + i} style={hs.day} />)}
        {Array.from({ length: count }, (_, i) => {
          const date = localDate(new Date(year, m, i + 1)), selected = date === selectedDate;
          return <Pressable key={date} accessibilityRole="button" accessibilityLabel={date} accessibilityState={{ selected }} onPress={() => setSelectedDate(date)} style={hs.day}>
            <View style={[hs.dayCircle, selected && { backgroundColor: '#AD83E9' }]}><Text style={{ color: selected ? 'white' : '#859CBF', fontSize: 13 }}>{i + 1}</Text></View>
            {personalTasks.some(t => t.date === date) && <View style={[hs.dot, { backgroundColor: selected ? '#B080E4' : '#F0D675' }]} />}
          </Pressable>;
        })}
      </View>
      {section(selectedDate === localDate() ? "Today's schedule" : selectedDate)}
      {taskRows(personalTasks.filter(t => t.date === selectedDate).sort((a, b) => a.time.localeCompare(b.time)), true)}
      <View style={hs.right}>{addButton()}</View>
    </>;
  }
  function renderRandom() {
    return <>
      <Text style={hs.step}>①  Select a group</Text>
      <Pressable style={hs.row} accessibilityRole="button" onPress={() => openSheet('choose-group')}>
        <View style={hs.circle}>{icon('people-outline', 23, '#8554DC')}</View><View style={hs.flex}><Text style={hs.rowText}>{currentGroup.name}</Text><Text style={hs.small}>{currentGroup.members.length} members</Text></View>{icon('chevron-forward')}
      </Pressable>
      <Text style={hs.step}>②  Choose tasks to assign</Text>
      <View style={hs.box}>{pendingGroupTasks.map(task => <Pressable key={task.id} style={hs.selectionRow} accessibilityRole="checkbox" accessibilityLabel={`Select ${task.title}`} accessibilityState={{ checked: selectedTasks.includes(task.id) }} onPress={() => toggleChoice(setSelectedTasks, task.id)}>
        {icon('document-text-outline', 16, '#AE85DB')}<Text style={[hs.rowText, { fontSize: 13 }]}>{task.title}</Text>{icon(selectedTasks.includes(task.id) ? 'checkbox' : 'square-outline', 20, '#A487DD')}</Pressable>)}</View>
      {!pendingGroupTasks.length && <Text style={hs.muted}>No pending tasks. Add a task to this group first.</Text>}
      {currentGroup.joined && <Pressable style={hs.outlineButton} accessibilityRole="button" onPress={() => openTask()}><Text style={hs.link}>+ Add Group Task</Text></Pressable>}
      <Text style={hs.step}>③  Select members <Text style={hs.small}>   {selectedMembers.length} selected</Text></Text>
      <Pressable style={hs.row} accessibilityRole="button" onPress={() => openSheet('members')}>
        <View style={hs.circle}>{icon('people-outline', 22, '#8554DC')}</View><Text style={[hs.rowText, hs.flex]} numberOfLines={1}>{selectedMembers.map(memberName).join(', ') || 'Select members'}</Text>{icon('chevron-forward')}
      </Pressable>
      {gradientButton('🎲  Randomize', randomize, groupBusy || !pendingGroupTasks.some(t => selectedTasks.includes(t.id)) || !selectedMembers.length)}
      <Pressable style={[hs.outlineButton, { marginTop: 12 }]} accessibilityRole="button" onPress={() => { setSelectedTasks([]); setSelectedMembers([]); setResults([]); setNotice('Selections cleared. Choose tasks and members again.'); }}>
        {icon('refresh-outline', 17)}<Text style={hs.small}>Reset & Choose Again</Text></Pressable>
    </>;
  }
  const title = { Tasks: 'My Tasks', Groups: 'Groups', Calendar: 'Calendar', Me: 'My Profile', Randomize: 'Randomize Tasks', 'Group Detail': 'Group Assignment' }[active];
  return <LinearGradient colors={['#FFFCFF', '#FCFDFF', '#F7FEFC']} style={styles.background}>
    <StatusBar barStyle="dark-content" />
    <SafeAreaView style={hs.safe}>
      <View style={hs.shell}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={hs.content}>
          <View style={hs.header}>
            {(active === 'Randomize' || active === 'Group Detail') && <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => navigate(active === 'Randomize' ? 'Home' : 'Groups')}>{icon('chevron-back', 24)}</Pressable>}
            <View style={hs.flex}><Text style={hs.greeting}>{active === 'Home' ? `Hi, ${profile.name}! 👋` : title}</Text>
              {active === 'Home' && <Text style={hs.subtitle}>Small steps, big progress!</Text>}</View>
            {active === 'Home' && <Pressable accessibilityRole="button" accessibilityLabel="Notifications" hitSlop={10} onPress={() => openSheet('notifications')}>{icon('notifications-outline', 28, '#4E57A4')}</Pressable>}
            {active === 'Groups' && <Pressable style={hs.createGroup} accessibilityRole="button" onPress={() => openSheet('create-group', { name: '' })}><Text style={hs.link}>+ Create Group</Text></Pressable>}
          </View>
          {databaseState !== 'ready' && <View style={[hs.notice, { marginTop: 0, marginBottom: 16 }] }>
            <Text style={[hs.rowText, hs.flex]}>{databaseState === 'loading' ? 'กำลังโหลดงาน…' : 'โหลดงานไม่สำเร็จ'}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="โหลดงานใหม่" disabled={databaseState === 'loading' || taskBusy || groupBusy} onPress={reloadAll}><Text style={hs.link}>โหลดใหม่</Text></Pressable>
          </View>}
          {groupsState !== 'ready' && ['Groups', 'Group Detail', 'Randomize'].includes(active) && <Text style={[hs.small, { marginBottom: 14 }]}>{groupsState === 'loading' ? 'กำลังโหลดกลุ่ม…' : 'โหลดกลุ่มไม่สำเร็จ กรุณาลองใหม่'}</Text>}
          {active === 'Home' && <>
            <Pressable accessibilityRole="button" onPress={() => { setFilter('Today'); navigate('Tasks'); }}>
              <LinearGradient colors={['#FAD8FA', '#FCD9EF', '#FFF5C5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.8 }} style={hs.banner}>
                <View style={hs.star}>{icon('star-outline', 29, '#EBD05E')}</View><View style={hs.flex}><Text style={hs.bannerTitle}>Today&apos;s Task</Text><Text style={hs.bannerSubtitle}>{completed ? `${completed} tasks completed` : 'Keep going!'}</Text></View><View style={hs.bannerArrow}>{icon('chevron-forward', 21, '#70C8DC')}</View>
              </LinearGradient>
            </Pressable>
            {section('My Tasks', 'Tasks')}{taskRows(personalTasks.filter(t => t.date === localDate()).slice(0, 3))}
            {section('Group Assignment', 'Groups')}{groupRows(groups.filter(g => g.joined).slice(0, 1))}
            <View style={hs.actions}><Pressable accessibilityRole="button" style={hs.random} onPress={() => navigate('Randomize')}><Text style={{ fontSize: 23 }}>🎲</Text><Text style={hs.randomText}>Randomize Tasks</Text></Pressable>{addButton()}</View>
          </>}
          {active === 'Tasks' && <>
            <View style={hs.segment}>{['Today', 'This Week', 'All'].map(value => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: filter === value }} onPress={() => setFilter(value)} style={[hs.segmentItem, filter === value && hs.segmentSelected]}><Text style={{ color: filter === value ? 'white' : '#8BA0C0', fontSize: 13 }}>{value}</Text></Pressable>)}</View>
            <View style={hs.searchRow}>{icon('search-outline', 19)}<TextInput accessibilityLabel="Search tasks" value={query} onChangeText={setQuery} placeholder="Search task..." placeholderTextColor="#9BAAC4" style={hs.search} />
              <Pressable accessibilityRole="button" accessibilityLabel="Filter tasks" onPress={() => openSheet('filter')}>{icon('options-outline', 24)}</Pressable></View>
            {categoryFilter !== 'All' && <Pressable onPress={() => setCategoryFilter('All')}><Text style={hs.link}>{categoryFilter}  × Clear filter</Text></Pressable>}
            {taskRows(filteredTasks, true)}<View style={hs.right}>{addButton()}</View>
          </>}
          {active === 'Groups' && <>
            <Pressable style={[hs.outlineButton, { marginBottom: 16 }]} accessibilityRole="button" onPress={() => openSheet('join-group', { invite_code: '' })}>
              {icon('key-outline', 20, '#A487DD')}<Text style={hs.link}>เข้าร่วมด้วยรหัส · Join with Code</Text>
            </Pressable>
            <View style={hs.segment}>{['My Groups', 'Join Group'].map(value => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: groupTab === value }} onPress={() => setGroupTab(value)} style={[hs.segmentItem, groupTab === value && hs.segmentSelected]}><Text style={{ color: groupTab === value ? 'white' : '#8BA0C0', fontSize: 13 }}>{value}</Text></Pressable>)}</View>
            {groupTab === 'My Groups' ? groupRows(groups) : <Text style={hs.subtitle}>กลุ่มเป็นส่วนตัว กดเข้าร่วมด้วยรหัสด้านบนเพื่อเข้ากลุ่มของเพื่อน</Text>}
          </>}
          {active === 'Group Detail' && <>
            <View style={hs.profileHero}><View style={hs.avatar}>{icon(currentGroup.icon, 40, '#8654DA')}</View><Text style={hs.sectionTitle}>{currentGroup.name}</Text><Text style={hs.subtitle}>{currentGroup.members.length} members</Text></View>
            {section('Members')}<View style={hs.chips}>{currentGroup.members.map(member => <Text key={member.id} style={hs.memberChip}>{member.name}{member.id === user.id ? ' (คุณ)' : ''}</Text>)}</View>
            {currentGroup.id && <>
              <Pressable style={[hs.outlineButton, { marginBottom: 16 }]} onPress={() => setChatOpen(true)}><Text style={hs.link}>💬 Group Chat</Text></Pressable>
              <Pressable style={hs.outlineButton} accessibilityRole="button" onPress={() => openSheet('invite')}>
                {icon('person-add-outline', 20, '#A487DD')}<Text style={hs.link}>เชิญเพื่อน · Invite Friends</Text>
              </Pressable>
              {section('Group Tasks')}
              {gradientButton('+ Add Group Task', () => openTask())}
              <View style={{ marginTop: 14 }}>{taskRows(currentGroupTasks, true)}</View>
              {section('Assigned tasks')}
              {currentGroupTasks.filter(t => t.assigned_to).map(task => <View key={task.id} style={hs.row}>{icon('person-circle-outline', 26, '#AA80DE')}<View style={hs.flex}><Text style={hs.rowText}>{memberName(task.assigned_to)}</Text><Text style={hs.small}>{task.title}</Text></View></View>)}
              {!currentGroupTasks.some(t => t.assigned_to) && <Text style={[hs.muted, { marginBottom: 20 }]}>No tasks assigned yet.</Text>}
              {gradientButton('🎲  Assign tasks randomly', () => { setSelectedTasks(pendingGroupTasks.map(t => t.id)); setSelectedMembers(currentGroup.members.map(member => member.id)); navigate('Randomize'); })}
            </>}
          </>}
          {active === 'Calendar' && renderCalendar()}
          {active === 'Randomize' && (currentGroup.id ? renderRandom() : <Text style={hs.subtitle}>กรุณาสร้างหรือเข้าร่วมกลุ่มจากหน้า Groups ก่อนสุ่มงาน</Text>)}
          {active === 'Me' && <>
            <LinearGradient colors={['#E8D8FF', '#FFF2CC', '#DEFAF1']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={hs.profileHero}>
              <View style={hs.avatar}>{icon('person-outline', 40, '#8654DA')}</View><Text style={hs.sectionTitle}>{profile.name}</Text><Text style={hs.small}>{profile.email}</Text>
            </LinearGradient>
            <View style={hs.box}>{[['My Profile', 'person-outline', 'profile'], ['Settings', 'settings-outline', 'settings'], ['Help & Support', 'help-circle-outline', 'help'], ['Log Out', 'log-out-outline', 'logout']].map(([label, itemIcon, name]) => <Pressable key={label} style={hs.menuRow} accessibilityRole="button" onPress={() => openSheet(name, name === 'profile' ? profile : {})}>{icon(itemIcon, 21, '#797BC0')}<Text style={[hs.rowText, hs.flex]}>{label}</Text>{icon('chevron-forward', 17)}</Pressable>)}</View>
            <Text style={[hs.small, { textAlign: 'center', marginTop: 20 }]}>{completed} of {tasks.length} tasks completed</Text>
          </>}
          {!!notice && <Pressable accessibilityRole="button" accessibilityLabel="Dismiss message" style={hs.notice} onPress={() => setNotice('')}><Text style={[hs.rowText, hs.flex]}>{notice}</Text>{icon('close', 18)}</Pressable>}
        </ScrollView>
        {chatOpen && currentGroup.id && <GroupChat group={currentGroup} user={user} onClose={() => setChatOpen(false)} />}
        <View style={hs.nav} accessibilityRole="tablist">{NAV_ITEMS.map(([label, itemIcon]) => {
          const selected = active === label || (label === 'Groups' && (active === 'Randomize' || active === 'Group Detail'));
          return <Pressable key={label} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => navigate(label)} style={hs.navItem}>
            <View style={[hs.navIcon, selected && { backgroundColor: '#EDDDFF' }]}>{icon(itemIcon, 26, selected ? '#8754EA' : '#97AECD')}</View><Text style={[hs.navText, selected && { color: '#8754EA', fontWeight: '700' }]}>{label}</Text></Pressable>;
        })}</View>
      </View>
    </SafeAreaView>
    <Modal visible={!!sheet} transparent animationType="slide" onRequestClose={closeSheet}>
      <KeyboardAvoidingView style={hs.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={closeSheet} accessibilityLabel="Close dialog" />
        <View style={hs.dialog} accessibilityViewIsModal>
          <View style={hs.handle} />
          <View style={hs.dialogHeader}><Text style={hs.sectionTitle}>{({ task: form.id ? 'Edit task' : form.group_id ? 'Add a group task' : 'Add a new task', 'create-group': 'Create Group', invite: 'เชิญเพื่อน · Invite Friends', 'join-group': 'เข้าร่วมด้วยรหัส', 'choose-group': 'Select a group', members: 'Select members', result: 'Your Tasks Are Assigned!', profile: 'My Profile', settings: 'Settings', help: 'Help & Support', logout: 'Log Out', filter: 'Filter tasks', notifications: 'Notifications' })[sheet]}</Text><Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={closeSheet} hitSlop={10}>{icon('close', 23)}</Pressable></View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 15 }}>
            {sheet === 'task' && <>
              {textInput('Task name', 'title', 'Task name...', { maxLength: 120 })}
              <View style={hs.formColumns}><View style={hs.flex}>{textInput('Date', 'date', 'YYYY-MM-DD', { maxLength: 10, autoCapitalize: 'none' })}</View><View style={hs.flex}>{textInput('Time', 'time', 'HH:MM', { maxLength: 5, keyboardType: 'numbers-and-punctuation' })}</View></View>
              <Text style={hs.inputLabel}>Category</Text>{chips(CATEGORIES, form.category, v => updateForm('category', v), CATEGORY_COLORS)}
              <Text style={hs.inputLabel}>Priority</Text>{chips(['Low', 'Medium', 'High'], form.priority, v => updateForm('priority', v), PRIORITY_COLORS)}
              {form.id && <Pressable style={hs.selectionRow} accessibilityRole="checkbox" accessibilityState={{ checked: form.done }} onPress={() => updateForm('done', !form.done)}>{icon(form.done ? 'checkbox' : 'square-outline', 22, '#A487DD')}<Text style={hs.rowText}>Completed</Text></Pressable>}
            </>}
            {sheet === 'create-group' && <>{textInput('Group name', 'name', 'e.g. Project Team', { maxLength: 60 })}<Text style={hs.small}>You are included automatically.</Text></>}
            {sheet === 'invite' && <View style={hs.resultHero}>
              <Text style={hs.sectionTitle}>{currentGroup.name}</Text>
              <Text style={hs.subtitle}>ส่งรหัสนี้ให้เพื่อน เพื่อเข้าร่วมกลุ่ม</Text>
              <Text selectable accessibilityLabel="Group invite code" style={{ color: '#7653C1', fontSize: 32, fontWeight: '700', letterSpacing: 5, marginVertical: 20 }}>{currentGroup.invite_code}</Text>
              <Text style={hs.small}>ให้เพื่อน Login ด้วยบัญชีของตัวเอง แล้วกรอกรหัสนี้</Text>
            </View>}
            {sheet === 'join-group' && <>
              {textInput('รหัสเชิญ · Invite code', 'invite_code', 'รหัสเชิญจากเพื่อน', { autoCapitalize: 'characters', autoCorrect: false, maxLength: 32, onSubmitEditing: joinByCode, returnKeyType: 'go' })}
              <Text style={[hs.small, { marginTop: 12 }]}>ใช้รหัสของกลุ่มจริงที่เพื่อนส่งให้ ระบบจะตรวจสอบรหัสเชิญ</Text>
            </>}
            {sheet === 'choose-group' && groups.filter(g => g.joined).map(g => <Pressable key={g.id} style={hs.row} accessibilityRole="button" onPress={() => chooseGroup(g.id)}><Text style={[hs.rowText, hs.flex]}>{g.name}</Text>{icon(g.id === groupId ? 'radio-button-on' : 'radio-button-off', 22, '#A487DD')}</Pressable>)}
            {sheet === 'members' && currentGroup.members.map(member => <Pressable key={member.id} style={hs.selectionRow} accessibilityRole="checkbox" accessibilityState={{ checked: selectedMembers.includes(member.id) }} onPress={() => toggleChoice(setSelectedMembers, member.id)}>{icon('person-circle-outline', 25, '#A487DD')}<Text style={[hs.rowText, hs.flex]}>{member.name}</Text>{icon(selectedMembers.includes(member.id) ? 'checkbox' : 'square-outline', 22, '#A487DD')}</Pressable>)}
            {sheet === 'result' && <><View style={hs.resultHero}><Text style={{ fontSize: 37 }}>🎉 🎲 🎉</Text><Text style={hs.subtitle}>Here&apos;s how the tasks are distributed:</Text></View>{results.map((r, i) => <View key={i} style={hs.row}>{icon('person-circle-outline', 25, '#A487DD')}<Text style={[hs.rowText, { flex: 0.8 }]}>{r.member}</Text><Text style={[hs.small, { flex: 1.2 }]}>{r.task}</Text></View>)}</>}
            {sheet === 'profile' && <>{textInput('Name', 'name', 'Your name', { maxLength: 30 })}{textInput('Email', 'email', 'you@example.com', { editable: false, autoCapitalize: 'none', keyboardType: 'email-address' })}</>}
            {sheet === 'filter' && chips(['All', ...CATEGORIES], categoryFilter, setCategoryFilter, CATEGORY_COLORS)}
            {sheet === 'settings' && <><View style={hs.selectionRow}><View style={hs.flex}><Text style={hs.rowText}>In-app reminders</Text><Text style={hs.small}>Show your pending tasks in Notifications</Text></View><Switch accessibilityLabel="In-app reminders" value={reminders} onValueChange={setReminders} trackColor={{ false: '#DDDDE8', true: '#C79AE5' }} /></View><Text style={hs.small}>These settings apply while the app is open.</Text></>}
            {sheet === 'notifications' && (reminders && personalTasks.some(t => !t.done && t.date <= localDate()) ? personalTasks.filter(t => !t.done && t.date <= localDate()).map(t => <Pressable key={t.id} style={hs.row} onPress={() => openTask(t)}><Text style={[hs.rowText, hs.flex]}>{t.title}</Text><Text style={hs.small}>{t.time}</Text></Pressable>) : <Text style={hs.subtitle}>You&apos;re all caught up!</Text>)}
            {sheet === 'help' && <Text style={hs.helpText}>• Tap a circle to complete a task.{'\n\n'}• Tap a task to edit its date, time, category, or priority.{'\n\n'}• Use + to add tasks.{'\n\n'}• Randomize Tasks distributes your selected tasks among the selected members.{'\n\n'}• Find assigned work in your group.</Text>}
            {sheet === 'logout' && <Text style={hs.subtitle}>ออกจากระบบหรือไม่? งาน กลุ่ม และสมาชิกที่บันทึกไว้จะยังอยู่</Text>}
            {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
            <View style={{ marginTop: 20 }}>
              {sheet === 'invite' && gradientButton('คัดลอกรหัส · Copy Code', copyInviteCode)}
              {sheet === 'join-group' && gradientButton(groupBusy ? 'กำลังเข้าร่วม…' : 'เข้าร่วมกลุ่ม · Join Group', joinByCode, groupBusy)}
              {sheet === 'task' && <Pressable accessibilityRole="button" disabled={taskBusy} onPress={saveTask}><LinearGradient colors={ACTION} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={hs.primary}><Text style={hs.primaryText}>{taskBusy ? 'กำลังบันทึก…' : 'Save'}</Text></LinearGradient></Pressable>}
              {sheet === 'create-group' && <Pressable accessibilityRole="button" disabled={groupBusy} onPress={saveGroup}><LinearGradient colors={ACTION} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={hs.primary}><Text style={hs.primaryText}>{groupBusy ? 'กำลังสร้าง…' : 'Create Group'}</Text></LinearGradient></Pressable>}
              {sheet === 'profile' && gradientButton('Save Profile', saveProfile)}
              {sheet === 'result' && gradientButton(groupBusy ? 'กำลังบันทึก…' : 'View in Group', saveAssignment, groupBusy)}
              {sheet === 'logout' && gradientButton('Log Out', onLogout)}
              {['members', 'filter', 'settings', 'help', 'notifications'].includes(sheet) && gradientButton('Done', closeSheet)}
              {sheet === 'task' && form.id && <Pressable accessibilityRole="button" style={{ alignItems: 'center', marginTop: 18 }} disabled={taskBusy} onPress={deleteTask}><Text style={{ color: '#C1769E' }}>Delete Task</Text></Pressable>}
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  </LinearGradient>;
}

const hs = StyleSheet.create({
  safe: { flex: 1, alignItems: 'center' }, shell: { flex: 1, width: '100%', maxWidth: 440 }, flex: { flex: 1 },
  content: { paddingHorizontal: 23, paddingTop: 26, paddingBottom: 25 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 24 },
  greeting: { color: '#354391', fontSize: 25, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { color: '#98ABCC', fontSize: 15, lineHeight: 22, marginTop: 7 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 23, marginBottom: 13, gap: 8 },
  sectionTitle: { color: '#354391', fontSize: 18, fontWeight: '700', flexShrink: 1 }, inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  muted: { color: '#97ACCB', fontSize: 13 }, small: { color: '#91A5C7', fontSize: 11, lineHeight: 17 },
  banner: { minHeight: 100, borderRadius: 23, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 13 },
  star: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFFFFFEE', justifyContent: 'center', alignItems: 'center' },
  bannerTitle: { color: '#3B4495', fontSize: 18, fontWeight: '700' }, bannerSubtitle: { color: '#A2A8CD', fontSize: 15, marginTop: 6 },
  bannerArrow: { width: 29, height: 29, borderRadius: 15, backgroundColor: '#D0F0E8', justifyContent: 'center', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 19, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F0F1FA', marginBottom: 10, shadowColor: '#A1A5D0', shadowOpacity: 0.09, shadowRadius: 7, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  check: { width: 28, height: 28, borderRadius: 15, borderWidth: 1.7, borderColor: '#B990ED', alignItems: 'center', justifyContent: 'center' }, checked: { backgroundColor: '#B990ED' },
  taskBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 }, rowText: { color: '#839BC2', fontSize: 14, lineHeight: 20, fontWeight: '500', flexShrink: 1 }, strike: { textDecorationLine: 'line-through', opacity: 0.55 },
  circle: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F0E7FF', alignItems: 'center', justifyContent: 'center' },
  badge: { overflow: 'hidden', borderRadius: 9, paddingHorizontal: 7, paddingVertical: 2, fontSize: 10, color: '#94A0BD' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 14 },
  random: { flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderStyle: 'dashed', borderColor: '#F1E4A1', borderRadius: 17, paddingVertical: 12, paddingHorizontal: 13 },
  randomText: { fontSize: 14, fontWeight: '600', color: '#839AC2' },
  add: { width: 55, height: 55, borderRadius: 28, alignItems: 'center', justifyContent: 'center' }, right: { alignItems: 'flex-end', marginTop: 15 },
  nav: { flexDirection: 'row', paddingVertical: 9, backgroundColor: '#FFFFFFF2', borderTopWidth: 1, borderTopColor: '#F1F3FA' }, navItem: { flex: 1, alignItems: 'center' },
  navIcon: { width: 44, height: 39, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }, navText: { color: '#96ACCA', fontSize: 10, marginTop: 3 },
  segment: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 24, borderWidth: 1, borderColor: '#F0EDF9', marginBottom: 18, overflow: 'hidden' },
  segmentItem: { flex: 1, minHeight: 39, alignItems: 'center', justifyContent: 'center', borderRadius: 23 }, segmentSelected: { backgroundColor: '#C694E4' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, borderWidth: 1, borderColor: '#EEEFF7', borderRadius: 22, backgroundColor: 'white', marginBottom: 17 }, search: { flex: 1, minWidth: 0, paddingVertical: 13, color: INK, fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 10 }, chip: { borderRadius: 17, paddingVertical: 9, paddingHorizontal: 13, borderWidth: 1.5, borderColor: 'transparent' }, chipSelected: { borderColor: '#B690E3' }, chipText: { color: '#8D99B4', fontSize: 12 },
  link: { color: '#AD7FD9', fontSize: 12, fontWeight: '600' }, createGroup: { borderWidth: 1, borderColor: '#EDCDF1', borderRadius: 18, paddingHorizontal: 9, paddingVertical: 8 },
  profileHero: { alignItems: 'center', borderRadius: 27, paddingVertical: 26, paddingHorizontal: 15, gap: 9, marginBottom: 20 }, avatar: { width: 75, height: 75, borderRadius: 38, backgroundColor: '#FFFFFFED', borderWidth: 4, borderColor: '#F3EDFF', alignItems: 'center', justifyContent: 'center' },
  box: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F0EFF8', borderRadius: 18, overflow: 'hidden', marginBottom: 12 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 15, paddingVertical: 17, borderBottomWidth: 1, borderBottomColor: '#F4F4FA' },
  step: { fontSize: 14, fontWeight: '600', color: '#454894', marginTop: 10, marginBottom: 12 },
  selectionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#F2F0F8' },
  primary: { minHeight: 45, borderRadius: 24, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 12 }, primaryText: { color: 'white', fontWeight: '700', fontSize: 14 },
  outlineButton: { borderWidth: 1, borderColor: '#E5E6F2', borderRadius: 24, minHeight: 44, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 },
  monthHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 14 }, calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 },
  day: { width: '14.285714%', height: 43, alignItems: 'center', justifyContent: 'center' }, dayCircle: { width: 29, height: 29, borderRadius: 15, justifyContent: 'center', alignItems: 'center' }, dot: { width: 4, height: 4, borderRadius: 2, marginTop: 2 },
  empty: { padding: 24, alignItems: 'center', gap: 14 }, memberChip: { borderRadius: 16, backgroundColor: '#EDE4FF', paddingVertical: 8, paddingHorizontal: 12, color: '#9476BD', fontSize: 13 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 15, padding: 14, borderRadius: 16, backgroundColor: '#F1ECFC' },
  overlay: { flex: 1, backgroundColor: '#30344D55', justifyContent: 'flex-end', alignItems: 'center', paddingTop: 45 },
  dialog: { backgroundColor: 'white', width: '100%', maxWidth: 440, maxHeight: '92%', borderTopLeftRadius: 29, borderTopRightRadius: 29, paddingHorizontal: 23, paddingBottom: 25 },
  handle: { width: 35, height: 4, borderRadius: 2, backgroundColor: '#E8E7EF', alignSelf: 'center', marginTop: 10, marginBottom: 18 }, dialogHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 },
  inputLabel: { color: '#91A2C1', fontSize: 12, marginTop: 7, marginBottom: 7 }, input: { minHeight: 45, borderWidth: 1, borderColor: '#E7E8F2', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12, color: INK, fontSize: 14, backgroundColor: '#FDFDFF' },
  formColumns: { flexDirection: 'row', gap: 12 }, resultHero: { alignItems: 'center', paddingVertical: 16 }, helpText: { fontSize: 14, lineHeight: 23, color: '#879BBE', marginTop: 10 },
});

const styles = StyleSheet.create({
  background: { flex: 1 },
  safe: { flex: 1 },
  scroll: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 18, paddingBottom: 24 },
  page: { width: '100%', maxWidth: 390, paddingTop: 12 },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, height: 42 },
  back: { width: 30, height: 34, borderRadius: 17, backgroundColor: '#8EDCE5', alignItems: 'center', justifyContent: 'center' },
  done: { color: INK, fontSize: 16, fontWeight: '700' },
  heading: { paddingLeft: 49, paddingTop: 18, paddingBottom: 25 },
  title: { fontSize: 32, fontWeight: '700', color: INK, letterSpacing: -0.8 },
  subtitle: { color: '#9396AC', fontSize: 17, marginTop: 4, letterSpacing: 0.1 },
  panel: { paddingTop: 19 },
  pastelBand: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderTopLeftRadius: 42, borderTopRightRadius: 17, borderBottomLeftRadius: 34, borderBottomRightRadius: 34 },
  tabs: { marginHorizontal: 31, height: 37, borderRadius: 22, backgroundColor: '#FFFFFFBB', flexDirection: 'row', overflow: 'hidden', marginBottom: 18 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 22, overflow: 'hidden' },
  tabText: { color: '#86899C', fontSize: 14, fontWeight: '600' },
  activeTab: { color: '#FFFFFF' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 36, paddingHorizontal: 25, paddingTop: 27, paddingBottom: 43, minHeight: 415, shadowColor: '#747591', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.07, shadowRadius: 14, elevation: 2 },
  field: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E8EAF1', borderRadius: 28, height: 54, marginBottom: 12, backgroundColor: '#FEFEFF' },
  fieldFocused: { borderColor: '#BBA2DC' },
  fieldIcon: { width: 43, height: 42, borderRightWidth: 1, borderRightColor: '#EFF0F5', alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, minWidth: 0, height: '100%', paddingHorizontal: 11, paddingVertical: 0, fontSize: 13, color: INK },
  eye: { width: 39, height: '100%', alignItems: 'center', justifyContent: 'center' },
  rememberRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: -1, marginBottom: 12, minHeight: 30 },
  rememberText: { color: '#9699AD', fontSize: 12 },
  switch: { transform: [{ scale: 0.72 }], marginRight: -6 },
  error: { color: '#B74771', fontSize: 12, marginBottom: 10 },
  loginButton: { borderRadius: 27, overflow: 'hidden', marginTop: 1 },
  loginGradient: { height: 51, alignItems: 'center', justifyContent: 'center' },
  loginText: { color: 'white', fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.75 },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 18 },
  line: { flex: 1, height: 1, backgroundColor: '#EFF0F5' },
  or: { color: '#9699AD', fontSize: 12, marginHorizontal: 13 },
  googleButton: { minHeight: 48, borderRadius: 27, borderWidth: 1, borderColor: '#E4E6EF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  googleText: { color: '#666A8B', fontWeight: '500', fontSize: 13, marginLeft: 12 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', marginTop: 22, gap: 9 },
  footerText: { color: '#A0A3B7', fontSize: 12 },
  footerLink: { color: '#C17FCA', fontSize: 13, fontWeight: '600' },
});
