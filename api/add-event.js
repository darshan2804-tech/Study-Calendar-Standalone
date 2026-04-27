const { db } = require('../lib/firebaseAdmin');

export default async function handler(req, res) {
  // 1. Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  // 2. Authenticate with SYNC_SECRET_KEY
  const authHeader = req.headers.authorization;
  const syncSecret = process.env.SYNC_SECRET_KEY;

  if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.split(' ')[1] !== syncSecret) {
    console.error('Auth Failure: Invalid Secret Key');
    return res.status(401).json({ error: 'Unauthorized. Invalid or missing Bearer token.' });
  }

  // 3. Extract Payload
  let userId = req.body.userId || req.body.userid;
  let { title, date, desc } = req.body;

  // --- SMART PARSING (If Gemini text is a JSON block) ---
  if (desc && desc.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(desc.trim());
      title = parsed.title || title;
      date = parsed.date || parsed.startTime || parsed.datetime || date;
      if (parsed.notes || parsed.desc || parsed.description) {
         desc = parsed.notes || parsed.desc || parsed.description;
      }
    } catch (e) {
      console.log('Desc is not valid JSON, using as raw text');
    }
  }

  // --- FALLBACKS & VALIDATION ---
  if (!userId) {
    console.error('Failure: Missing userId');
    return res.status(400).json({ error: 'Missing userId' });
  }

  // Default to today if date is missing
  if (!date || date === "") {
    let targetDate = new Date();
    const textToSearch = (cleanTitle + ' ' + cleanDesc).toLowerCase();
    
    if (textToSearch.includes('tomorrow')) {
      targetDate.setDate(targetDate.getDate() + 1);
      console.log('Detected "tomorrow" in text, adjusting date.');
    }
    
    date = targetDate.toISOString().split('T')[0];
    console.log('Date prioritized as:', date);
  }

  title = title || 'Calendar Event';
  desc = desc || 'Added via iPad Shortcut';

  // 4. Security Check
  const allowedUser = process.env.ALLOWED_USER_ID;
  if (allowedUser && userId !== allowedUser) {
    return res.status(403).json({ error: 'Forbidden. User ID mismatch.' });
  }

  // 5. Prettify Text
  const cleanTitle = title.trim().charAt(0).toUpperCase() + title.trim().slice(1);
  const cleanDesc = String(desc).trim()
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n');

  try {
    // 6. Save to Firestore
    const docRef = await db.collection('users').doc(userId).collection('events').add({
      title: cleanTitle,
      date: date.includes('T') ? date.split('T')[0] : date, 
      desc: cleanDesc,
      createdAt: new Date().toISOString(),
      source: 'iPad Shortcut'
    });

    return res.status(200).json({
      success: true,
      message: 'Event added successfully.',
      id: docRef.id
    });
  } catch (error) {
    console.error('Firestore Error:', error);
    return res.status(500).json({ error: 'Failed to save event.' });
  }
}
