import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  signInWithPopup,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { auth, db, googleProvider, isFirebaseConfigured } from './config'

const LOCAL_STORAGE_KEY = 'fasalsethu_current_user'
const LOCAL_USERS_DB_KEY = 'fasalsethu_registered_users'

// Default pre-seeded test accounts for instant evaluation
const DEFAULT_PRESET_USERS = [
  {
    uid: 'demo-farmer-001',
    email: 'farmer@fasalsethu.in',
    password: 'password123',
    name: 'Rameshwar Patil',
    phone: '9822012345',
    role: 'farmer',
    language: 'en',
    location: 'Dindori, Nashik, MH',
    createdAt: new Date('2026-01-15').toISOString(),
  },
  {
    uid: 'demo-buyer-001',
    email: 'buyer@fasalsethu.in',
    password: 'password123',
    name: 'Rajesh Agrawal',
    phone: '9811098765',
    businessName: 'AgroVentures Milling & Exports Ltd',
    role: 'buyer',
    language: 'en',
    location: 'Vashi APMC Mandi, Navi Mumbai',
    createdAt: new Date('2026-01-18').toISOString(),
  },
]

function getLocalUsers() {
  try {
    const raw = localStorage.getItem(LOCAL_USERS_DB_KEY)
    if (!raw) {
      localStorage.setItem(LOCAL_USERS_DB_KEY, JSON.stringify(DEFAULT_PRESET_USERS))
      return DEFAULT_PRESET_USERS
    }
    return JSON.parse(raw)
  } catch {
    return DEFAULT_PRESET_USERS
  }
}

function saveLocalUser(userData) {
  const users = getLocalUsers()
  const idx = users.findIndex(u => u.email.toLowerCase() === userData.email.toLowerCase())
  if (idx >= 0) {
    users[idx] = { ...users[idx], ...userData }
  } else {
    users.push(userData)
  }
  localStorage.setItem(LOCAL_USERS_DB_KEY, JSON.stringify(users))
}

// User-friendly error code mapping
export function mapAuthError(err) {
  if (!err) return 'An unexpected error occurred. Please try again.'
  console.error('[FasalSethu Auth Technical Log]:', err)

  const code = err.code || ''
  switch (code) {
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password.'
    case 'auth/user-not-found':
      return 'No account found with these credentials.'
    case 'auth/invalid-email':
      return 'Please enter a valid email address.'
    case 'auth/email-already-in-use':
      return 'This email is already registered. Please login instead.'
    case 'auth/weak-password':
      return 'Password should be at least 6 characters long.'
    case 'auth/network-request-failed':
      return 'Unable to connect. Please try again.'
    case 'auth/popup-closed-by-user':
      return 'Google sign-in was cancelled.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again in a few moments.'
    default:
      if (err.message && !err.message.includes('Firebase:')) {
        return err.message
      }
      return 'Authentication failed. Please check your details and try again.'
  }
}

// 1. Register User (Farmer or Buyer)
export async function registerUser({
  email,
  password,
  fullName,
  phone = '',
  role, // 'farmer' | 'buyer'
  language = 'en',
  businessName = '',
}) {
  const cleanEmail = email.trim().toLowerCase()

  if (isFirebaseConfigured && auth) {
    // Live Firebase Registration
    const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password)
    const user = userCredential.user

    if (fullName) {
      await updateProfile(user, { displayName: fullName }).catch(() => {})
    }

    const userProfile = {
      uid: user.uid,
      name: fullName,
      email: cleanEmail,
      phone,
      role,
      language,
      businessName: role === 'buyer' ? businessName : null,
      createdAt: new Date().toISOString(),
    }

    // Save profile to Firestore
    if (db) {
      await setDoc(doc(db, 'users', user.uid), userProfile, { merge: true })
    }

    // Cache locally for immediate fast access
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(userProfile))
    saveLocalUser({ ...userProfile, password })

    return { user, profile: userProfile }
  } else {
    // Simulated Local Firebase Registration
    const users = getLocalUsers()
    const existing = users.find(u => u.email.toLowerCase() === cleanEmail)
    if (existing) {
      const err = new Error('This email is already registered. Please login instead.')
      err.code = 'auth/email-already-in-use'
      throw err
    }

    const mockUid = 'user_' + Date.now() + Math.random().toString(36).substr(2, 6)
    const userProfile = {
      uid: mockUid,
      name: fullName,
      email: cleanEmail,
      phone,
      role,
      language,
      businessName: role === 'buyer' ? businessName : null,
      createdAt: new Date().toISOString(),
    }

    saveLocalUser({ ...userProfile, password })
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(userProfile))
    window.dispatchEvent(new Event('fasalsethu_auth_changed'))

    return {
      user: { uid: mockUid, email: cleanEmail, displayName: fullName },
      profile: userProfile,
    }
  }
}

// 2. Login with Email / Phone
export async function loginUser({ emailOrPhone, password, expectedRole }) {
  const identifier = emailOrPhone.trim().toLowerCase()

  if (isFirebaseConfigured && auth) {
    // If user entered phone number instead of email in live Firebase, lookup local cache or email alias
    let targetEmail = identifier
    if (!identifier.includes('@')) {
      const users = getLocalUsers()
      const found = users.find(u => u.phone === identifier)
      if (found) {
        targetEmail = found.email
      }
    }

    const userCredential = await signInWithEmailAndPassword(auth, targetEmail, password)
    const user = userCredential.user

    // Fetch user profile & role from Firestore
    let profile = null
    if (db) {
      const snap = await getDoc(doc(db, 'users', user.uid))
      if (snap.exists()) {
        profile = snap.data()
      }
    }

    // Fallback if Firestore record not yet created
    if (!profile) {
      const users = getLocalUsers()
      const local = users.find(u => u.uid === user.uid || u.email === user.email)
      profile = local || {
        uid: user.uid,
        name: user.displayName || 'User',
        email: user.email,
        role: expectedRole || 'farmer',
        language: 'en',
      }
    }

    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(profile))
    return { user, profile }
  } else {
    // Simulated Local Firebase Login
    const users = getLocalUsers()
    const found = users.find(
      u => (u.email.toLowerCase() === identifier || u.phone === identifier) && u.password === password
    )

    if (!found) {
      const err = new Error('Incorrect email or password.')
      err.code = 'auth/invalid-credential'
      throw err
    }

    const profile = {
      uid: found.uid,
      name: found.name,
      email: found.email,
      phone: found.phone,
      role: found.role,
      businessName: found.businessName,
      language: found.language || 'en',
    }

    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(profile))
    window.dispatchEvent(new Event('fasalsethu_auth_changed'))

    return {
      user: { uid: profile.uid, email: profile.email, displayName: profile.name },
      profile,
    }
  }
}

// 3. Login with Google
export async function loginWithGoogle(role = 'farmer') {
  if (isFirebaseConfigured && auth && googleProvider) {
    const result = await signInWithPopup(auth, googleProvider)
    const user = result.user

    let profile = null
    if (db) {
      const snap = await getDoc(doc(db, 'users', user.uid))
      if (snap.exists()) {
        profile = snap.data()
      } else {
        profile = {
          uid: user.uid,
          name: user.displayName || 'Google User',
          email: user.email,
          role,
          language: 'en',
          createdAt: new Date().toISOString(),
        }
        await setDoc(doc(db, 'users', user.uid), profile)
      }
    } else {
      profile = {
        uid: user.uid,
        name: user.displayName || 'Google User',
        email: user.email,
        role,
        language: 'en',
      }
    }

    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(profile))
    return { user, profile }
  } else {
    // Simulated Google Popup
    const mockUid = 'google_' + Date.now()
    const profile = {
      uid: mockUid,
      name: role === 'farmer' ? 'Kisan Google Member' : 'Institutional Buyer Rep',
      email: role === 'farmer' ? 'farmer.google@fasalsethu.in' : 'buyer.google@fasalsethu.in',
      role,
      language: 'en',
      createdAt: new Date().toISOString(),
    }
    saveLocalUser({ ...profile, password: 'google_auth_token' })
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(profile))
    window.dispatchEvent(new Event('fasalsethu_auth_changed'))

    return {
      user: { uid: mockUid, email: profile.email, displayName: profile.name },
      profile,
    }
  }
}

// 4. Logout User
export async function logoutUser() {
  if (isFirebaseConfigured && auth) {
    await signOut(auth).catch(() => {})
  }
  localStorage.removeItem(LOCAL_STORAGE_KEY)
  window.dispatchEvent(new Event('fasalsethu_auth_changed'))
}

// 5. Send Password Reset
export async function sendPasswordReset(email) {
  const cleanEmail = email.trim().toLowerCase()
  if (isFirebaseConfigured && auth) {
    await sendPasswordResetEmail(auth, cleanEmail)
    return true
  } else {
    const users = getLocalUsers()
    const found = users.find(u => u.email.toLowerCase() === cleanEmail)
    if (!found) {
      const err = new Error('No account found with these credentials.')
      err.code = 'auth/user-not-found'
      throw err
    }
    return true
  }
}

// 6. Subscribe to Auth State (Live + Local)
export function subscribeToAuthState(callback) {
  let isMounted = true

  function resolveState() {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
      if (raw) {
        const profile = JSON.parse(raw)
        return {
          user: { uid: profile.uid, email: profile.email, displayName: profile.name },
          role: profile.role,
          profile,
          loading: false,
        }
      }
    } catch {
      // fallback
    }
    return { user: null, role: null, profile: null, loading: false }
  }

  if (isFirebaseConfigured && auth) {
    const unsubscribeFirebase = onAuthStateChanged(auth, async firebaseUser => {
      if (!isMounted) return

      if (firebaseUser) {
        let profile = null
        if (db) {
          try {
            const snap = await getDoc(doc(db, 'users', firebaseUser.uid))
            if (snap.exists()) profile = snap.data()
          } catch {
            // ignore
          }
        }

        if (!profile) {
          try {
            const cached = localStorage.getItem(LOCAL_STORAGE_KEY)
            if (cached) profile = JSON.parse(cached)
          } catch {}
        }

        const role = profile?.role || 'farmer'
        callback({
          user: firebaseUser,
          role,
          profile,
          loading: false,
        })
      } else {
        localStorage.removeItem(LOCAL_STORAGE_KEY)
        callback({ user: null, role: null, profile: null, loading: false })
      }
    })

    return () => {
      isMounted = false
      unsubscribeFirebase()
    }
  } else {
    // Initial emission
    const initial = resolveState()
    callback(initial)

    // Listen for local changes
    const handler = () => {
      if (isMounted) {
        callback(resolveState())
      }
    }

    window.addEventListener('fasalsethu_auth_changed', handler)
    window.addEventListener('storage', handler)

    return () => {
      isMounted = false
      window.removeEventListener('fasalsethu_auth_changed', handler)
      window.removeEventListener('storage', handler)
    }
  }
}
