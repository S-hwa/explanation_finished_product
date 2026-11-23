/* Shared browser demo data. Replace this module with your backend when ready. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.document) {
    root.LibraDemo = api.createStore({
      storage: {
        getItem: key => root.localStorage.getItem(key),
        setItem: (key, value) => root.localStorage.setItem(key, value)
      },
      sessionStorage: {
        getItem: key => root.sessionStorage.getItem(key),
        setItem: (key, value) => root.sessionStorage.setItem(key, value),
        removeItem: key => root.sessionStorage.removeItem(key)
      },
      notify: () => root.dispatchEvent(new CustomEvent('libra:datachange')),
      lock: action => root.navigator.locks
        ? root.navigator.locks.request('libra-demo-data', action)
        : Promise.resolve().then(action)
    });
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const DATA_KEY = 'libra.demo.data.v1';
  const SESSION_KEY = 'libra.demo.session.v1';
  const TIME_ZONE = 'Asia/Manila';
  const DEMO_PASSWORD = 'libra123';
  const PROGRAMS = [
    'BS Computer Science', 'BS Information Technology', 'BS Business Management',
    'Bachelor of Secondary Education', 'BS Psychology', 'BS Nursing',
    'BS Hospitality Management', 'BS Criminology'
  ];
  const dayFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit'
  });

  function dateKey(value = new Date()) {
    const parts = Object.fromEntries(dayFormatter.formatToParts(new Date(value))
      .filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  function formatDate(value, options = {}) {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(value))
      ? new Date(`${value}T12:00:00+08:00`) : new Date(value);
    return new Intl.DateTimeFormat('en-PH', {
      timeZone: TIME_ZONE, month: 'short', day: 'numeric', year: 'numeric', ...options
    }).format(date);
  }

  function formatTime(value) {
    return new Intl.DateTimeFormat('en-PH', {
      timeZone: TIME_ZONE, hour: 'numeric', minute: '2-digit', hour12: true
    }).format(new Date(value));
  }

  function hourLabel(hour) {
    return `${hour % 12 || 12} ${hour < 12 ? 'AM' : 'PM'}`;
  }

  function visitHour(visit) {
    return Number(new Intl.DateTimeFormat('en-GB', {
      timeZone: TIME_ZONE, hour: '2-digit', hourCycle: 'h23'
    }).format(new Date(visit.checkedInAt)));
  }

  function trafficForDay(visits, day) {
    const hours = Array(24).fill(0);
    const daily = visits.filter(visit => visit.day === day);
    daily.forEach(visit => { hours[visitHour(visit)] += 1; });
    const peakCount = Math.max(...hours);
    return {
      hours, entries: daily.length,
      uniqueStudents: new Set(daily.map(visit => visit.studentNumber)).size,
      peakHour: peakCount ? hours.indexOf(peakCount) : null,
      peakCount,
      qr: daily.filter(visit => visit.method === 'QR').length,
      manual: daily.filter(visit => visit.method === 'Manual').length
    };
  }

  function seedData(now) {
    const people = [
      ['Maria Santos', 0], ['John Dela Cruz', 1], ['Andrea Garcia', 2],
      ['Miguel Reyes', 3], ['Sofia Mendoza', 4], ['Gabriel Ramos', 5],
      ['Bea Castillo', 6], ['Luis Torres', 0], ['Camille Flores', 1],
      ['Paolo Navarro', 7], ['Nicole Aquino', 4], ['Rafael Lim', 2]
    ];
    const students = people.map(([name, program], index) => ({
      studentNumber: `2026-${String(index + 1).padStart(4, '0')}`,
      name, program: PROGRAMS[program],
      email: `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
      profileUpdatedAt: null
    }));
    const visits = [];
    const today = dateKey(now);
    for (let offset = 0; offset < 21; offset += 1) {
      const date = new Date(`${today}T12:00:00+08:00`);
      date.setUTCDate(date.getUTCDate() - offset);
      if (date.getUTCDay() === 0) continue;
      const day = dateKey(date);
      for (let hour = 7; hour <= 18; hour += 1) {
        const count = hour === 9 ? 6 : hour === 10 ? 5 : hour === 8 ? 4 : 3;
        for (let entry = 0; entry < count; entry += 1) {
          const checkedInAt = new Date(`${day}T${String(hour).padStart(2, '0')}:${String((entry * 10 + offset) % 60).padStart(2, '0')}:00+08:00`);
          if (checkedInAt > now) continue;
          const student = students[(offset * 5 + hour * 3 + entry) % students.length];
          visits.push({
            id: `sample-${day}-${hour}-${entry}`, studentNumber: student.studentNumber,
            name: student.name, program: student.program, day,
            checkedInAt: checkedInAt.toISOString(),
            method: (offset + hour + entry) % 7 === 0 ? 'Manual' : 'QR'
          });
        }
      }
    }
    return {
      version: 1, createdAt: now.toISOString(), students, visits,
      librarians: [{ librarianId: 'LIB-001', name: 'Ana Reyes' }]
    };
  }

  function createStore(options) {
    const { storage, sessionStorage } = options;
    const now = options.now || (() => new Date());
    const notify = options.notify || (() => {});
    const lock = options.lock || (action => Promise.resolve().then(action));

    function save(state) {
      try { storage.setItem(DATA_KEY, JSON.stringify(state)); }
      catch (_) { throw new Error('Your browser could not save the demo. Enable site storage and try again.'); }
      notify();
    }

    function getState() {
      let stored;
      try { stored = storage.getItem(DATA_KEY); }
      catch (_) { throw new Error('Browser storage is unavailable. Please allow site storage to use this demo.'); }
      if (!stored) {
        const seeded = seedData(now());
        save(seeded);
        return seeded;
      }
      let state;
      try { state = JSON.parse(stored); }
      catch (_) { throw new Error('The saved demo data could not be read.'); }
      if (state.version !== 1 || !Array.isArray(state.students) || !Array.isArray(state.visits) || !Array.isArray(state.librarians)) {
        throw new Error('The saved demo data has an unsupported format.');
      }
      return state;
    }

    function getSession() {
      try {
        const session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
        return session && ['student', 'librarian'].includes(session.role) && typeof session.id === 'string'
          ? session : null;
      } catch (_) { return null; }
    }

    function signIn(role, identifier, password) {
      const state = getState();
      const id = String(identifier).trim().toUpperCase();
      const account = role === 'student'
        ? state.students.find(student => student.studentNumber === id)
        : role === 'librarian' ? state.librarians.find(librarian => librarian.librarianId === id) : null;
      if (!account || password !== DEMO_PASSWORD) {
        throw new Error(`Use a registered ${role === 'librarian' ? 'librarian ID' : 'student number'} and the demo password libra123.`);
      }
      try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ role, id, signedInAt: now().toISOString() })); }
      catch (_) { throw new Error('Your browser could not start the demo session. Please allow site storage.'); }
      return account;
    }

    function currentAccount(role) {
      const session = getSession();
      if (!session || session.role !== role) return null;
      const state = getState();
      return role === 'student'
        ? state.students.find(student => student.studentNumber === session.id) || null
        : state.librarians.find(librarian => librarian.librarianId === session.id) || null;
    }

    function requireRole(role) {
      const account = currentAccount(role);
      if (!account) throw new Error(`Sign in as a ${role} to continue.`);
      return account;
    }

    function validateProfile(values) {
      const profile = {
        name: String(values.name || '').trim().replace(/\s+/g, ' '),
        program: String(values.program || '').trim(),
        email: String(values.email || '').trim().toLowerCase()
      };
      if (profile.name.length < 2 || profile.name.length > 80) throw new Error('Enter a name between 2 and 80 characters.');
      if (!PROGRAMS.includes(profile.program)) throw new Error('Select a program from the list.');
      if (profile.email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) throw new Error('Enter a valid email address.');
      return profile;
    }

    function updateProfile(values) {
      return lock(() => {
        const account = requireRole('student');
        const state = getState();
        const student = state.students.find(item => item.studentNumber === account.studentNumber);
        if (student.profileUpdatedAt) throw new Error('Your one profile update has already been used. Your details are now read-only.');
        const profile = validateProfile(values);
        if (['name', 'program', 'email'].every(key => profile[key] === student[key])) {
          throw new Error('Change at least one detail before saving. Your one update is still available.');
        }
        Object.assign(student, profile, { profileUpdatedAt: now().toISOString() });
        save(state);
        return student;
      });
    }

    function recordManualEntry(studentNumber) {
      return lock(() => {
        requireRole('librarian');
        const state = getState();
        const number = String(studentNumber).trim().toUpperCase();
        const student = state.students.find(item => item.studentNumber === number);
        if (!student) throw new Error('No registered account matches that student number. Check the number and try again.');
        const timestamp = now();
        if (state.visits.some(visit => visit.studentNumber === number &&
          timestamp - new Date(visit.checkedInAt) >= 0 && timestamp - new Date(visit.checkedInAt) < 60000)) {
          throw new Error('This student already has an entry from the last minute. Check the attendance log before recording another.');
        }
        const visit = {
          id: `manual-${timestamp.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
          studentNumber: number, name: student.name, program: student.program,
          day: dateKey(timestamp), checkedInAt: timestamp.toISOString(), method: 'Manual'
        };
        state.visits.push(visit);
        save(state);
        return visit;
      });
    }

    function signOut() { sessionStorage.removeItem(SESSION_KEY); }

    return {
      DATA_KEY, SESSION_KEY, TIME_ZONE, DEMO_PASSWORD, PROGRAMS,
      getState, getSession, signIn, signOut, currentAccount,
      updateProfile, validateProfile, recordManualEntry,
      dateKey, formatDate, formatTime, hourLabel, trafficForDay
    };
  }

  return { createStore, seedData, dateKey, formatDate, formatTime, hourLabel, trafficForDay, PROGRAMS, DATA_KEY, SESSION_KEY };
});
