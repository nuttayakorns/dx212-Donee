import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';
import { supabase } from '../lib/supabase';

const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'];
const LIMIT = 10 * 1024 * 1024;
const BUCKET = 'chat-images';
export default function GroupChat({ group, user, onClose }) {
  const [rows, setRows] = useState([]);
  const [text, setText] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const scroll = useRef(null);
  const mounted = useRef(true);
  const loadingRef = useRef(false);
  const urls = useRef(new Map());
  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const { data, error: failure } = await supabase.from('messages').select('*').eq('group_id', group.id).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(100);
      if (failure) throw failure;
      const messages = await Promise.all(data.reverse().map(async row => {
        if (!row.file_path || !row.file_type?.startsWith('image/')) return row;
        let cached = urls.current.get(row.file_path);
        if (!cached || cached.expires < Date.now()) {
          const signed = await supabase.storage.from(BUCKET).createSignedUrl(row.file_path, 600);
          if (!signed.error) { cached = { url: signed.data.signedUrl, expires: Date.now() + 540000 }; urls.current.set(row.file_path, cached); }
        }
        return { ...row, preview: cached?.url };
      }));
      if (mounted.current) { setRows(messages); setLoading(false); }
    } catch { if (mounted.current) { setError('โหลดแชทไม่ได้ กรุณาลองใหม่'); setLoading(false); } }
    finally { loadingRef.current = false; }
  }, [group.id]);
  useEffect(() => {
    mounted.current = true;
    load();
    const timer = setInterval(load, 5000);
    return () => { mounted.current = false; clearInterval(timer); };
  }, [load]);
  async function pick() {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: TYPES, copyToCacheDirectory: true, multiple: false });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!TYPES.includes(asset.mimeType)) return setError('รองรับ JPG, PNG, WebP, PDF, DOCX และ PPTX');
      if (asset.size > LIMIT) return setError('กรุณาเลือกไฟล์ขนาดไม่เกิน 10 MB');
      setAttachment(asset); setError('');
    } catch { setError('เปิดตัวเลือกไฟล์ไม่ได้ กรุณาลองใหม่'); }
  }
  async function send() {
    if (busy || (!text.trim() && !attachment)) return;
    setBusy(true); setError('');
    let path = null;
    try {
      if (attachment) {
        const bytes = Platform.OS === 'web' ? await attachment.file.arrayBuffer() : await new File(attachment.uri).arrayBuffer();
        if (!bytes.byteLength || bytes.byteLength > LIMIT) throw new Error('ไฟล์ต้องมีขนาดมากกว่า 0 และไม่เกิน 10 MB');
        const extensions = ['jpg', 'png', 'webp', 'pdf', 'docx', 'pptx'];
        path = `${group.id}/${Crypto.randomUUID()}.${extensions[TYPES.indexOf(attachment.mimeType)]}`;
        const uploaded = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: attachment.mimeType, upsert: false });
        if (uploaded.error) throw new Error('อัปโหลดไฟล์ไม่สำเร็จ กรุณาลองใหม่');
      }
      const result = await supabase.from('messages').insert({ group_id: group.id, user_id: user.id, content: text.trim() || null, file_path: path, file_name: attachment?.name || null, file_type: attachment?.mimeType || null, file_size: attachment?.size || null });
      if (result.error) {
        const failure = result.error;
        const reason = failure.code === '42501'
          ? 'ไม่มีสิทธิ์ส่งแชท: ตรวจ INSERT policy ของ messages และสมาชิกกลุ่ม'
          : failure.code === '23503'
            ? 'ไม่พบข้อมูลผู้ส่งหรือกลุ่มที่อ้างอิง'
            : failure.code === '23514'
              ? 'ข้อความหรือไฟล์ไม่ผ่านเงื่อนไขของตาราง'
              : 'บันทึกข้อความไม่สำเร็จ';
        throw new Error(`${reason} (${failure.code || 'unknown'}): ${failure.message}`);
      }
      setText(''); setAttachment(null); await load();
    } catch (failure) { setError(failure.message); }
    finally { if (mounted.current) setBusy(false); }
  }
  async function openFile(row) {
    try {
      const { data, error: failure } = await supabase.storage.from(BUCKET).createSignedUrl(row.file_path, 60);
      if (failure) throw failure;
      await Linking.openURL(data.signedUrl);
    } catch { setError('เปิดไฟล์ไม่ได้ กรุณาลองใหม่'); }
  }
  return <Modal visible animationType="slide" onRequestClose={onClose}><SafeAreaView style={s.root}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.header}><Pressable onPress={onClose} accessibilityLabel="ปิดแชท"><Text style={s.link}>‹ กลับ</Text></Pressable><Text style={s.title}>{group.name}</Text><Pressable onPress={() => { setError(''); load(); }}><Text style={s.link}>โหลดใหม่</Text></Pressable></View>
      <ScrollView ref={scroll} contentContainerStyle={s.list} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })} keyboardShouldPersistTaps="handled">
        {loading && <Text style={s.small}>กำลังโหลดแชท…</Text>}
        {!loading && !rows.length && <Text style={s.small}>เริ่มคุยกับเพื่อนในกลุ่มได้เลย</Text>}
        {rows.map(row => <View key={row.id} style={[s.bubble, row.user_id === user.id && s.mine]}>
          <Text style={s.sender}>{row.user_id === user.id ? 'คุณ' : group.members.find(m => m.id === row.user_id)?.name || 'สมาชิก'}</Text>
          {!!row.content && <Text selectable style={s.body}>{row.content}</Text>}
          {!!row.file_path && <Pressable onPress={() => openFile(row)} accessibilityLabel={`เปิดไฟล์ ${row.file_name}`}>
            {!!row.preview && <Image source={{ uri: row.preview }} style={s.image} resizeMode="contain" />}
            <Text style={s.link}>📎 {row.file_name || 'เปิดไฟล์แนบ'}</Text>
            {!!row.file_size && <Text style={s.small}>{(row.file_size / 1024).toFixed(0)} KB</Text>}
          </Pressable>}
          <Text style={s.small}>{new Date(row.created_at).toLocaleString('th-TH')}</Text>
        </View>)}
      </ScrollView>
      {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
      {!!attachment && <View style={s.attachment}><Text style={{ flex: 1 }}>{attachment.name}</Text><Pressable disabled={busy} onPress={() => setAttachment(null)}><Text style={s.link}>เอาออก</Text></Pressable></View>}
      <View style={s.composer}><Pressable disabled={busy} onPress={pick} accessibilityLabel="แนบรูปหรือเอกสาร"><Text style={s.link}>📎</Text></Pressable><TextInput editable={!busy} multiline maxLength={5000} placeholder="พิมพ์ข้อความ…" value={text} onChangeText={setText} style={s.input} /><Pressable disabled={busy || (!text.trim() && !attachment)} onPress={send}><Text style={s.link}>{busy ? 'กำลังส่ง…' : 'ส่ง'}</Text></Pressable></View>
    </KeyboardAvoidingView>
  </SafeAreaView></Modal>;
}
const s = StyleSheet.create({ root: { flex: 1, backgroundColor: '#FCFAFF' }, header: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 18, borderBottomWidth: 1, borderColor: '#ECE7F4' }, title: { flex: 1, color: '#414477', fontSize: 20, fontWeight: '700' }, link: { color: '#885AC6', fontSize: 16, fontWeight: '600' }, list: { padding: 18, gap: 14 }, bubble: { alignSelf: 'flex-start', maxWidth: '88%', padding: 14, borderRadius: 20, backgroundColor: '#EDF5FC', gap: 8 }, mine: { alignSelf: 'flex-end', backgroundColor: '#F0E2FB' }, sender: { color: '#7653A2', fontWeight: '700' }, body: { color: '#414477', fontSize: 17 }, small: { color: '#8497B5', fontSize: 12 }, image: { width: 230, height: 190, borderRadius: 12 }, composer: { padding: 14, flexDirection: 'row', gap: 14, alignItems: 'center', backgroundColor: '#FFFFFF' }, input: { flex: 1, padding: 12, borderWidth: 1, borderColor: '#E4DDEF', borderRadius: 18, maxHeight: 120, color: '#414477' }, error: { padding: 12, color: '#B33965' }, attachment: { padding: 12, flexDirection: 'row', gap: 12, backgroundColor: '#EEE7FA' } });
