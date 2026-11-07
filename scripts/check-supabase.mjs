// Read-only check. Never prints credentials or user data.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key || key.startsWith('sb_secret_')) {
  console.error('ตรวจชื่อ URL และ Publishable key ใน .env.local'); process.exit(1);
}
try {
  for (const path of ['/auth/v1/settings', '/rest/v1/tasks?select=id&limit=0', '/rest/v1/profiles?select=id&limit=0']) {
    const response = await fetch(new URL(path, url), { headers: { apikey: key } });
    console.log(`${path.split('?')[0]}: ${response.ok ? 'OK' : `HTTP ${response.status}`}`);
    if (!response.ok) process.exitCode = 1;
  }
  console.log('เป็นการตรวจการติดต่อเท่านั้น ต้อง Login และทดสอบเพิ่มงานจริงเพื่อยืนยันสิทธิ์อ่าน/เขียน');
} catch { console.error('เชื่อมต่อไม่ได้ กรุณาตรวจอินเทอร์เน็ตและค่าใน .env.local'); process.exitCode = 1; }
