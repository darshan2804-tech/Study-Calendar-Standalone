const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyBRw3GxukFyPEcjOY-0FIsXBk2p-7TQivM",
  authDomain:        "study-tracker-52de8.firebaseapp.com",
  projectId:         "study-tracker-52de8",
  storageBucket:     "study-tracker-52de8.firebasestorage.app",
  messagingSenderId: "183173939785",
  appId:             "1:183173939785:web:5fc5eee2f86b87c356b598"
};

const ADMIN_EMAILS = ["darshanderkar20@gmail.com","derkardarshan@gmail.com"];

firebase.initializeApp(FIREBASE_CONFIG);
const auth = firebase.auth();
const db   = firebase.firestore();

let currentUser = null;
let entries     = [];
let curCalDate  = new Date();
let isLoading   = true;

// --- INITIALIZE THEME ---
applyTheme();
renderCalendar();

// --- AUTHENTICATION ---
const authScreen = document.getElementById('authScreen');
const loginStatus = document.getElementById('loginStatus');

auth.onAuthStateChanged(async user => {
  if (user) {
    if (ADMIN_EMAILS.includes(user.email) || user.email === 'derkardarshan@gmail.com') {
      currentUser = user;
      authScreen.style.display = 'none';
      loadEntriesRealtime();
      startNotificationEngine();
    } else {
      try {
        const doc = await db.collection('users').doc(user.uid).get();
        if (doc.exists && doc.data().status === 'approved') {
          currentUser = user;
          authScreen.style.display = 'none';
          loadEntriesRealtime();
          startNotificationEngine();
        } else {
          loginStatus.innerHTML = "Access Restricted. <br> Please wait for admin approval.";
          loginStatus.style.display = 'block';
          auth.signOut();
        }
      } catch (e) {
        loginStatus.innerHTML = "Access Restricted. <br> Error verifying account.";
        loginStatus.style.display = 'block';
        auth.signOut();
      }
    }
  } else {
    authScreen.style.display = 'flex';
  }
});

window.submitLogin = async function() {
  const btn = document.getElementById('btnLogin');
  const email = document.getElementById('loginEmail').value.trim();
  const pass = document.getElementById('loginPass').value;
  if(!email || !pass) return;
  btn.textContent = "Negotiating...";
  loginStatus.style.display = 'none';
  try {
    if ('Notification' in window && Notification.permission !== "granted") {
      Notification.requestPermission();
    }
    await auth.signInWithEmailAndPassword(email, pass);
  } catch(e) {
    loginStatus.textContent = e.message;
    loginStatus.style.display = 'block';
    btn.textContent = "Sign In";
  }
};

// --- SAAS THEME SYNC ---
function applyTheme() {
  const params = new URLSearchParams(window.location.search);
  const theme = params.get('theme') || localStorage.getItem('study_tracker_theme') || 'dark';
  document.body.className = theme + '-theme';
  localStorage.setItem('study_tracker_theme', theme);
  
  // SEO & Meta updates
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if(metaTheme) metaTheme.setAttribute('content', theme === 'dark' ? '#020617' : '#ffffff');
}

// --- DATA LAYER ---
function loadEntriesRealtime() {
  db.collection('users').doc(currentUser.uid).collection('entries')
    .onSnapshot(snap => {
      entries = snap.docs.map(doc => ({id: doc.id, ...doc.data()}));
      isLoading = false;
      renderCalendar();
    }, err => {
      isLoading = false;
      renderCalendar();
    });
}

// --- UTILS ---
function toLocalDate(d){ return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate()); }
function p(n){ return n < 10 ? '0'+n : n; }

// --- PREMIUM CALENDAR RENDER ---
function renderCalendar() {
  const grid = document.getElementById('fullCalendarGrid');
  const title = document.getElementById('monthTitle');
  if(!grid || !title) return;
  
  const year = curCalDate.getFullYear();
  const month = curCalDate.getMonth();
  const todayStr = toLocalDate(new Date());
  
  title.textContent = curCalDate.toLocaleDateString('en-IN', {month:'long', year:'numeric'});
  
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  
  if (isLoading) {
    let skeletonHtml = '';
    for(let i=0; i<35; i++){ skeletonHtml += `<div class="cal-cell skeleton"></div>`; }
    grid.innerHTML = skeletonHtml;
    return;
  }

  const eventMap = {};
  entries.forEach(e => {
    (e.revisions || []).forEach(r => {
      let rDate = null;
      if (r.datetime) {
        if (typeof r.datetime.toDate === 'function') rDate = r.datetime.toDate();
        else rDate = new Date(r.datetime);
      }
      if(rDate && !isNaN(rDate.getTime())) {
        const dateStr = toLocalDate(rDate);
        if(!eventMap[dateStr]) eventMap[dateStr] = [];
        eventMap[dateStr].push({id: e.id, topic: e.topic || 'Revision', subject: e.subject || 'Other', label: r.label || 'Task'});
      }
    });
  });

  let html = '';
  for(let i = firstDay; i > 0; i--) { html += `<div class="cal-cell other-month"><div class="cell-date">${daysInPrev - i + 1}</div></div>`; }
  
  for(let d = 1; d <= daysInMonth; d++) {
    const ds = `${year}-${p(month+1)}-${p(d)}`;
    const evs = eventMap[ds] || [];
    const isToday = (ds === todayStr);
    const isMobile = window.innerWidth < 600;
    
    let blocks = '';
    if (isMobile) {
      blocks = `<div class="events-container mobile-dots">`;
      evs.slice(0, 5).forEach(ev => {
        let dotId = '4';
        if(ev.subject === 'Physics') dotId = '1';
        else if(ev.subject === 'Chemistry') dotId = '2';
        else if(ev.subject === 'Maths') dotId = '3';
        blocks += `<div class="event-dot-mobile dot-${dotId}"></div>`;
      });
      if(evs.length > 5) blocks += `<div style="font-size:0.5rem; color:var(--text-muted); line-height:1;">+</div>`;
      blocks += `</div>`;
    } else {
      blocks = '<div class="events-container">';
      evs.slice(0, 3).forEach(ev => {
        let dotId = '4';
        if(ev.subject === 'Physics') dotId = '1';
        else if(ev.subject === 'Chemistry') dotId = '2';
        else if(ev.subject === 'Maths') dotId = '3';
        blocks += `<div class="event-badge"><div class="event-dot dot-${dotId}"></div>${ev.topic}</div>`;
      });
      if(evs.length > 3) blocks += `<div style="font-size:0.55rem; color:var(--text-muted); padding-left:4px; font-weight:700;">+ ${evs.length - 3} more</div>`;
      blocks += '</div>';
    }
    
    html += `
      <div class="cal-cell ${isToday ? 'today' : ''}" onclick="openModal('${ds}')">
        <div class="cell-date">${d}</div>
        ${blocks}
      </div>
    `;
  }
  
  const fill = (7 - ((firstDay + daysInMonth) % 7)) % 7;
  for(let j = 1; j <= fill; j++) { html += `<div class="cal-cell other-month"><div class="cell-date">${j}</div></div>`; }
  
  grid.innerHTML = html;
}

document.getElementById('prevMonth').addEventListener('click', () => { curCalDate.setMonth(curCalDate.getMonth() - 1); renderCalendar(); });
document.getElementById('nextMonth').addEventListener('click', () => { curCalDate.setMonth(curCalDate.getMonth() + 1); renderCalendar(); });
document.getElementById('btnToday').addEventListener('click', () => { curCalDate = new Date(); renderCalendar(); });
document.getElementById('btnLogout').addEventListener('click', () => {
  if(confirm("Are you sure you want to log out?")) {
    auth.signOut().then(() => window.location.reload());
  }
});

// --- MODAL & DELETION ---
window.deleteEntry = async function(docId, topic) {
  if (!confirm(`Permanently delete "${topic}" and all 7 scheduled revisions?`)) return;
  try {
    await db.collection('users').doc(currentUser.uid).collection('entries').doc(String(docId)).delete();
    document.getElementById('eventModal').style.display = 'none';
  } catch(e) { alert('Sync error: ' + e.message); }
}

window.openModal = function(dateStr) {
  const modal = document.getElementById('eventModal');
  const dTitle = document.getElementById('modalDateTitle');
  const list = document.getElementById('modalEventsList');
  if(!modal || !dTitle || !list) return;

  const d = new Date(dateStr);
  dTitle.textContent = d.toLocaleDateString('en-IN', {weekday:'long', month:'long', day:'numeric'});
  
  let evs = [];
  entries.forEach(e => {
    (e.revisions || []).forEach(r => {
      let rDate = null;
      if (r.datetime) {
        if (typeof r.datetime.toDate === 'function') rDate = r.datetime.toDate();
        else rDate = new Date(r.datetime);
      }
      if(rDate && !isNaN(rDate.getTime()) && toLocalDate(rDate) === dateStr) {
        evs.push({id: e.id, topic: e.topic, subject: e.subject, label: r.label, time: rDate.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})});
      }
    });
  });
  
  if(!evs.length) {
    list.innerHTML = `<div style="text-align:center; padding:40px 20px; color:var(--text-muted);">
      <div style="font-size:2rem; margin-bottom:10px;">☕</div>
      <p style="font-size:0.9rem; font-weight:500;">No revisions scheduled for this day.</p>
    </div>`;
  } else {
    list.innerHTML = evs.map(ev => {
      let accent = 'var(--subject-4)';
      if(ev.subject === 'Physics') accent = 'var(--subject-1)';
      else if(ev.subject === 'Chemistry') accent = 'var(--subject-2)';
      else if(ev.subject === 'Maths') accent = 'var(--subject-3)';
      return `
      <div class="modal-event-item">
        <div class="event-indicator" style="background:${accent}"></div>
        <div class="event-info">
          <h4>${ev.topic}</h4>
          <p>${ev.subject} • ${ev.time} • ${ev.label}</p>
        </div>
        <button class="delete-btn" onclick="event.stopPropagation(); deleteEntry('${ev.id}', decodeURIComponent('${encodeURIComponent(ev.topic)}'))">🗑️</button>
      </div>`;
    }).join('');
  }
  modal.style.display = 'flex';
}

document.getElementById('closeModal').addEventListener('click', () => { document.getElementById('eventModal').style.display = 'none'; });
document.getElementById('eventModal').addEventListener('click', (e) => { 
  if(e.target === modal) document.getElementById('eventModal').style.display = 'none'; 
});

// --- EXPORT ---
document.getElementById('btnExport').addEventListener('click', () => {
  if(!entries.length) return alert('No data to export');
  let icsLines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Study Cal//EN', 'CALSCALE:GREGORIAN'];
  const nowStr = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  entries.forEach(e => {
    (e.revisions || []).forEach((r, idx) => {
      let rDate = null;
      if (r.datetime) {
        if (typeof r.datetime.toDate === 'function') rDate = r.datetime.toDate();
        else rDate = new Date(r.datetime);
      }
      if(!rDate || isNaN(rDate.getTime())) return;
      const fStart = rDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      const fEnd = new Date(rDate.getTime() + 3600000).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      icsLines = icsLines.concat(['BEGIN:VEVENT', `UID:${e.id}-${idx}`, `DTSTAMP:${nowStr}`, `DTSTART:${fStart}`, `DTEND:${fEnd}`, `SUMMARY:Revise ${e.topic}`, `DESCRIPTION:${ev.subject} - ${r.label}`, 'END:VEVENT']);
    });
  });
  icsLines.push('END:VCALENDAR');
  const blob = new Blob([icsLines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'study_cal.ics'; a.click();
});

// --- NOTIFICATION ENGINE ---
function startNotificationEngine() {
  if (Notification.permission !== "granted") return;
  setInterval(() => {
    const now = new Date();
    if (now.getSeconds() > 2) return; 
    entries.forEach(e => {
      (e.revisions || []).forEach(r => {
        let rv = null;
        if (r.datetime) {
          if (typeof r.datetime.toDate === 'function') rv = r.datetime.toDate();
          else rv = new Date(r.datetime);
        }
        if(!rv || isNaN(rv.getTime())) return;
        const diff = Math.round((rv.getTime() - now.getTime()) / 60000);
        if (diff === 10) triggerNotification(`Upcoming: ${e.topic}`, `Revision in 10 mins (${r.label})`);
        else if (diff === 0) triggerNotification(`Now: ${e.topic}`, `Time to revise (${r.label})`);
      });
    });
  }, 1000);
}

function triggerNotification(title, body) {
  if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
    navigator.serviceWorker.ready.then(reg => { reg.showNotification(title, { body: body, icon: './icon-192.png' }); });
  } else { new Notification(title, { body: body }); }
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(console.error);
